import { describe, expect, it, vi } from 'vitest';
import type { query } from '@anthropic-ai/claude-agent-sdk';
import { CodeReviewOrchestrator } from '../src/orchestrator.js';
import { ReviewReportSchema, type ReviewReport } from '../src/types/index.js';

const reportFixture: ReviewReport = {
  pullRequest: { owner: 'octocat', repo: 'Hello-World', number: 7 },
  fileReviews: [{
    file: 'src/index.ts',
    codeQuality: { file: 'src/index.ts', issues: [], overallScore: 95, summary: 'Sound change.' },
    testCoverage: {
      file: 'src/index.ts', hasTests: true, testFiles: ['src/index.test.ts'], untestedPaths: [],
      coverageEstimate: 90, summary: 'Main behavior is covered.'
    },
    refactorings: { file: 'src/index.ts', suggestions: [], summary: 'No substantial refactoring.' }
  }],
  summary: { totalFiles: 1, overallScore: 95, criticalIssues: 0, highPriorityTests: 0, refactoringOpportunities: 0 },
  recommendations: [],
  metadata: {
    analyzedAt: '2026-08-30T10:00:00.000Z', duration: 100,
    agentVersions: { orchestrator: 'sonnet', quality: 'inherit', coverage: 'inherit', refactoring: 'inherit' }
  }
};

function successfulQuery(onCall?: (input: unknown) => void): typeof query {
  const implementation = async function* (input: unknown) {
    onCall?.(input);
    yield { type: 'result', subtype: 'success', structured_output: reportFixture };
  };
  return implementation as unknown as typeof query;
}

describe('CodeReviewOrchestrator', () => {
  const baseOptions = {
    model: 'test-model',
    projectRoot: process.cwd(),
    maxRetries: 0,
    timeoutMs: 1_000
  };

  it('initializes with defaults supplied by the environment', () => {
    vi.stubEnv('ANTHROPIC_MODEL', 'test-model');
    vi.stubEnv('PROJECT_ROOT', process.cwd());
    const orchestrator = new CodeReviewOrchestrator({ queryFn: successfulQuery() });
    expect(orchestrator.getRateLimitStatus().availableRequests).toBe(50);
    vi.unstubAllEnvs();
  });

  it('accepts custom rate limits', () => {
    const orchestrator = new CodeReviewOrchestrator({
      ...baseOptions,
      queryFn: successfulQuery(),
      rateLimits: { maxRequestsPerMinute: 3, maxTokensPerMinute: 20_000, maxConcurrent: 1 }
    });
    expect(orchestrator.getRateLimitStatus()).toMatchObject({ availableRequests: 3, availableTokens: 20_000 });
  });

  it('configures GitHub MCP and all three Task subagents', async () => {
    let captured: unknown;
    const orchestrator = new CodeReviewOrchestrator({
      ...baseOptions,
      queryFn: successfulQuery(input => { captured = input; })
    });
    await orchestrator.reviewPullRequest('octocat', 'Hello-World', 7);
    const call = captured as { options: { mcpServers: Record<string, unknown>; agents: Record<string, unknown>; allowedTools: string[] } };
    expect(call.options.mcpServers).toHaveProperty('github');
    expect(Object.keys(call.options.agents)).toHaveLength(3);
    expect(call.options.allowedTools).toContain('Task');
  });

  it('aggregates and validates a structured ReviewReport', async () => {
    const orchestrator = new CodeReviewOrchestrator({ ...baseOptions, queryFn: successfulQuery() });
    const report = await orchestrator.reviewPullRequest('octocat', 'Hello-World', 7);
    expect(ReviewReportSchema.safeParse(report).success).toBe(true);
    expect(report.fileReviews[0]?.codeQuality.overallScore).toBe(95);
  });

  it('rejects invalid structured output', async () => {
    const invalidQuery = (async function* () {
      yield { type: 'result', subtype: 'success', structured_output: { invalid: true } };
    }) as unknown as typeof query;
    const orchestrator = new CodeReviewOrchestrator({ ...baseOptions, queryFn: invalidQuery });
    await expect(orchestrator.reviewPullRequest('octocat', 'Hello-World', 7)).rejects.toThrow('validation failed');
  });

  it('rejects invalid PR coordinates before calling the SDK', async () => {
    const queryFn = vi.fn();
    const orchestrator = new CodeReviewOrchestrator({
      ...baseOptions,
      queryFn: queryFn as unknown as typeof query
    });
    await expect(orchestrator.reviewPullRequest('', 'repo', 0)).rejects.toThrow('positive integer');
    expect(queryFn).not.toHaveBeenCalled();
  });

  it.skip('reviews a real public PR when credentials are configured', async () => {});
});
