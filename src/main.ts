import * as dotenv from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CodeReviewOrchestrator } from './orchestrator.js';
import { ReportGenerator, formatError } from './utils/index.js';

dotenv.config();

export type OutputFormat = 'json' | 'md' | 'html' | 'all';
interface CliArguments { owner: string; repo: string; prNumber: number; format: OutputFormat; }

export function parseArguments(args: string[]): CliArguments {
  let owner: string | undefined;
  let repo: string | undefined;
  let prText: string | undefined;
  let format: OutputFormat = 'all';

  if (args.length >= 2 && args[0]?.includes('/')) {
    const parts = args[0].split('/');
    [owner, repo] = parts;
    prText = args[1];
    if (args[2]) format = args[2] as OutputFormat;
  } else {
    [owner, repo, prText] = args;
    if (args[3]) format = args[3] as OutputFormat;
  }

  const prNumber = Number(prText);
  if (!owner || !repo || !prText || !Number.isInteger(prNumber) || prNumber <= 0 || !['json', 'md', 'html', 'all'].includes(format)) {
    throw new Error('Usage: npm run dev -- <owner/repo> <positive-pr-number> [json|md|html|all]');
  }
  return { owner, repo, prNumber, format };
}

export function validateEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  const hasAnthropic = Boolean(env.ANTHROPIC_API_KEY);
  const hasBedrock = Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_REGION);
  if (!hasAnthropic && !hasBedrock) throw new Error('Authentication missing. Set ANTHROPIC_API_KEY, or AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_REGION.');
  if (!env.ANTHROPIC_MODEL) throw new Error('ANTHROPIC_MODEL is required.');
  if (!env.PROJECT_ROOT || !path.isAbsolute(env.PROJECT_ROOT)) throw new Error('PROJECT_ROOT is required and must be an absolute path.');
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is required for GitHub MCP access. Add a read-only GitHub token to .env.');
}

async function saveReports(owner: string, repo: string, prNumber: number, format: OutputFormat, report: Awaited<ReturnType<CodeReviewOrchestrator['reviewPullRequest']>>) {
  const safeName = `${owner}-${repo}-pr-${prNumber}`.replace(/[^a-zA-Z0-9._-]/g, '-');
  const outputDirectory = path.resolve('reports', safeName);
  const generator = new ReportGenerator();
  const content: Record<Exclude<OutputFormat, 'all'>, string> = {
    json: generator.generateJSONReport(report),
    md: generator.generateMarkdownReport(report),
    html: generator.generateHTMLReport(report)
  };
  const formats: Array<Exclude<OutputFormat, 'all'>> = format === 'all' ? ['json', 'md', 'html'] : [format];
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all(formats.map(selected => writeFile(path.join(outputDirectory, `report.${selected}`), content[selected], 'utf8')));
  return outputDirectory;
}

export async function main(args: string[] = process.argv.slice(2)): Promise<void> {
  try {
    const { owner, repo, prNumber, format } = parseArguments(args);
    validateEnvironment();
    console.log(process.env.ANTHROPIC_API_KEY ? '🔐 Using Anthropic API authentication' : '🔐 Using AWS Bedrock authentication');
    console.log(`🔍 Reviewing ${owner}/${repo}#${prNumber}...`);
    const report = await new CodeReviewOrchestrator().reviewPullRequest(owner, repo, prNumber);
    console.log(`✅ Review complete (verdict: ${report.verdict ?? 'comment'}, score: ${report.summary.overallScore})`);
    console.log(`📄 Reports written to ${await saveReports(owner, repo, prNumber, format, report)}`);
  } catch (error) {
    console.error(`❌ ${formatError(error)}`);
    process.exitCode = 1;
  }
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) void main();
