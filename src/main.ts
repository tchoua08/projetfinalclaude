import * as dotenv from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CodeReviewOrchestrator } from './orchestrator.js';
import { ReportGenerator, formatError } from './utils/index.js';

dotenv.config();

interface CliArguments {
  owner: string;
  repo: string;
  prNumber: number;
}

export function parseArguments(args: string[]): CliArguments {
  const [owner, repo, prText] = args;
  const prNumber = Number(prText);
  if (!owner || !repo || !prText || !Number.isInteger(prNumber) || prNumber <= 0) {
    throw new Error('Usage: npm run dev -- <owner> <repo> <positive-pr-number>');
  }
  return { owner, repo, prNumber };
}

export function validateEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  const hasAnthropic = Boolean(env.ANTHROPIC_API_KEY);
  const hasBedrock = Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_REGION);
  if (!hasAnthropic && !hasBedrock) {
    throw new Error(
      'Authentication missing. Set ANTHROPIC_API_KEY, or AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_REGION.'
    );
  }
  if (!env.ANTHROPIC_MODEL) throw new Error('ANTHROPIC_MODEL is required.');
  if (!env.PROJECT_ROOT || !path.isAbsolute(env.PROJECT_ROOT)) {
    throw new Error('PROJECT_ROOT is required and must be an absolute path.');
  }
}

async function saveReports(owner: string, repo: string, prNumber: number, report: Awaited<ReturnType<CodeReviewOrchestrator['reviewPullRequest']>>) {
  const safeName = `${owner}-${repo}-pr-${prNumber}`.replace(/[^a-zA-Z0-9._-]/g, '-');
  const outputDirectory = path.resolve('reports', safeName);
  const generator = new ReportGenerator();
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDirectory, 'report.json'), generator.generateJSONReport(report), 'utf8'),
    writeFile(path.join(outputDirectory, 'report.md'), generator.generateMarkdownReport(report), 'utf8'),
    writeFile(path.join(outputDirectory, 'report.html'), generator.generateHTMLReport(report), 'utf8')
  ]);
  return outputDirectory;
}

export async function main(args: string[] = process.argv.slice(2)): Promise<void> {
  try {
    const { owner, repo, prNumber } = parseArguments(args);
    validateEnvironment();
    const usingBedrock = !process.env.ANTHROPIC_API_KEY;
    console.log(usingBedrock ? '🔐 Using AWS Bedrock authentication' : '🔐 Using Anthropic API authentication');
    console.log(`🔍 Reviewing ${owner}/${repo}#${prNumber}...`);

    const orchestrator = new CodeReviewOrchestrator();
    const report = await orchestrator.reviewPullRequest(owner, repo, prNumber);
    const outputDirectory = await saveReports(owner, repo, prNumber, report);
    console.log(`✅ Review complete. Reports written to ${outputDirectory}`);
  } catch (error) {
    console.error(`❌ ${formatError(error)}`);
    process.exitCode = 1;
  }
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) void main();
