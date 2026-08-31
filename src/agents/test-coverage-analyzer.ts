import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { TEST_COVERAGE_ANALYZER_PROMPT } from '../prompts/index.js';

export const testCoverageAnalyzer: AgentDefinition = {
  description: 'Finds concrete untested behaviors, branches, errors, and edge cases introduced or affected by a PR.',
  prompt: TEST_COVERAGE_ANALYZER_PROMPT,
  model: 'inherit',
  tools: ['Read', 'Grep', 'Glob', 'Skill']
};
