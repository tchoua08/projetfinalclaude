import 'dotenv/config';
import { existsSync } from 'node:fs';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { reviewAgents } from './agents/index.js';
import { mcpServersConfig } from './config/mcp.config.js';
import { buildOrchestratorPrompt } from './prompts/index.js';
import { ReviewReportSchema, ReviewReportJSONSchema } from './types/report-types.js';
import type { ReviewReport } from './types/report-types.js';
import {
  ErrorCodes,
  RateLimiter,
  ReviewError,
  withRateLimit,
  withRetry,
  withTimeout
} from './utils/index.js';
import type { RateLimiterConfig } from './utils/index.js';
import { logger, logReviewComplete, logReviewError, logReviewStart } from './utils/logger.js';

type QueryFunction = typeof query;

export interface OrchestratorOptions {
  model?: string;
  projectRoot?: string;
  rateLimits?: Partial<RateLimiterConfig>;
  timeoutMs?: number;
  maxRetries?: number;
  queryFn?: QueryFunction;
}

async function* generateMessages(content: string) {
  yield {
    type: 'user' as const,
    message: { role: 'user' as const, content },
    parent_tool_use_id: null,
    session_id: `review-${Date.now()}`
  };
}

export class CodeReviewOrchestrator {
  private readonly model: string;
  private readonly projectRoot: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly rateLimiter: RateLimiter;
  private readonly queryFn: QueryFunction;

  constructor(options: OrchestratorOptions = {}) {
    const model = options.model ?? process.env.ANTHROPIC_MODEL;
    const projectRoot = options.projectRoot ?? process.env.PROJECT_ROOT;
    if (!model) {
      throw new ReviewError('ANTHROPIC_MODEL is required', ErrorCodes.INVALID_CONFIG);
    }
    if (!projectRoot) {
      throw new ReviewError('PROJECT_ROOT is required', ErrorCodes.INVALID_CONFIG);
    }

    this.model = model;
    this.projectRoot = existsSync(projectRoot) ? projectRoot : process.cwd();
    if (this.projectRoot !== projectRoot) {
      logger.warn('PROJECT_ROOT does not exist; using current working directory', {
        configuredProjectRoot: projectRoot,
        fallbackProjectRoot: this.projectRoot
      });
    }
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.rateLimiter = new RateLimiter(options.rateLimits);
    this.queryFn = options.queryFn ?? query;
  }

  getRateLimitStatus() {
    return this.rateLimiter.getStatus();
  }

  async reviewPullRequest(owner: string, repo: string, prNumber: number): Promise<ReviewReport> {
    this.validatePullRequest(owner, repo, prNumber);
    const startedAt = Date.now();
    logReviewStart(owner, repo, prNumber);

    try {
      const report = await withRateLimit(
        this.rateLimiter,
        () => withRetry(
          () => withTimeout(
            () => this.runReview(owner, repo, prNumber),
            this.timeoutMs,
            `Review timed out after ${this.timeoutMs}ms`
          ),
          this.maxRetries
        ),
        10_000
      );
      logReviewComplete(owner, repo, prNumber, report.summary.overallScore, Date.now() - startedAt);
      return report;
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      logReviewError(owner, repo, prNumber, normalized);
      throw error;
    }
  }

  private validatePullRequest(owner: string, repo: string, prNumber: number): void {
    if (!owner.trim() || !repo.trim() || !Number.isInteger(prNumber) || prNumber <= 0) {
      throw new ReviewError(
        'owner, repo, and a positive integer PR number are required',
        ErrorCodes.VALIDATION_FAILED,
        { owner, repo, prNumber }
      );
    }
  }

  private async runReview(owner: string, repo: string, prNumber: number): Promise<ReviewReport> {
    const startedAt = Date.now();
    const prompt = buildOrchestratorPrompt(owner, repo, prNumber);

    for await (const message of this.queryFn({
      prompt: generateMessages(prompt),
      options: {
        cwd: this.projectRoot,
        // npm/nvm/sudo environments can hide the `node` binary from child processes.
        // Use the exact interpreter running this process (the SDK type only exposes
        // named runtimes, so this narrow cast preserves its runtime contract).
        executable: process.execPath as 'node',
        env: {
          ...process.env,
          PATH: `${process.execPath.substring(0, process.execPath.lastIndexOf('/'))}:${process.env.PATH ?? ''}`
        },
        settingSources: ['project'],
        model: this.model,
        mcpServers: mcpServersConfig,
        agents: reviewAgents,
        allowedTools: [
          'Task',
          'Read',
          'Grep',
          'Glob',
          'Skill',
          'mcp__github__get_pull_request',
          'mcp__github__get_pull_request_files',
          'mcp__github__get_file_contents',
          'mcp__eslint__lint'
        ],
        outputFormat: {
          type: 'json_schema',
          schema: ReviewReportJSONSchema
        },
        // Keep child-process diagnostics visible; otherwise SDK exits only expose code 1.
        stderr: (data: string) => logger.error('Claude Code stderr', { data: data.trim() }),
        maxTurns: 40
      }
    })) {
      if (message.type === 'assistant' && Array.isArray(message.message?.content)) {
        for (const block of message.message.content) {
          if (block.type === 'tool_use') {
            logger.debug('Agent tool invoked', { tool: block.name });
          }
        }
      }

      if (message.type === 'result' && message.subtype === 'success' && message.structured_output) {
        const parsed = ReviewReportSchema.safeParse(message.structured_output);
        if (!parsed.success) {
          throw new ReviewError(
            `Review report validation failed: ${parsed.error.message}`,
            ErrorCodes.STRUCTURED_OUTPUT_FAILED,
            { issues: parsed.error.issues }
          );
        }
        const duration = Date.now() - startedAt;
        const fileReviews = parsed.data.fileReviews;
        const scores = fileReviews.map(file => file.codeQuality.overallScore);
        const overallScore = scores.length === 0
          ? 100
          : Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
        const criticalIssues = fileReviews.reduce(
          (sum, file) => sum + file.codeQuality.issues.filter(issue => issue.severity === 'critical').length,
          0
        );
        const highPriorityTests = fileReviews.reduce(
          (sum, file) => sum + file.testCoverage.untestedPaths.filter(path => path.priority === 'high' || path.priority === 'critical').length,
          0
        );
        const refactoringOpportunities = fileReviews.reduce((sum, file) => sum + file.refactorings.suggestions.length, 0);
        const verdict = criticalIssues > 0 || overallScore < 70
          ? 'request_changes'
          : overallScore >= 90 ? 'approve' : 'comment';
        return ReviewReportSchema.parse({
          ...parsed.data,
          verdict,
          summary: { totalFiles: fileReviews.length, overallScore, criticalIssues, highPriorityTests, refactoringOpportunities },
          metadata: { ...parsed.data.metadata, duration }
        });
      }

      if (message.type === 'result' && message.subtype !== 'success') {
        throw new ReviewError(
          `Agent SDK review failed: ${message.subtype}`,
          ErrorCodes.AGENT_FAILED,
          { subtype: message.subtype }
        );
      }
    }

    throw new ReviewError('Agent returned no review report', ErrorCodes.AGENT_FAILED);
  }
}
