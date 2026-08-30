import { describe, expect, it } from 'vitest';
import { parseArguments, validateEnvironment } from '../src/main.js';

describe('CLI validation', () => {
  it('parses owner, repository, and PR number', () => {
    expect(parseArguments(['octocat', 'Hello-World', '12'])).toEqual({
      owner: 'octocat', repo: 'Hello-World', prNumber: 12
    });
  });

  it.each([
    { args: [] },
    { args: ['owner', 'repo', 'zero'] },
    { args: ['owner', 'repo', '0'] },
    { args: ['owner', 'repo', '1.5'] }
  ])('rejects invalid arguments: $args', ({ args }) => {
    expect(() => parseArguments(args)).toThrow('Usage:');
  });

  it('accepts Anthropic authentication and required configuration', () => {
    expect(() => validateEnvironment({
      ANTHROPIC_API_KEY: 'test',
      ANTHROPIC_MODEL: 'model',
      PROJECT_ROOT: process.cwd()
    })).not.toThrow();
  });

  it('accepts complete Bedrock authentication', () => {
    expect(() => validateEnvironment({
      AWS_ACCESS_KEY_ID: 'test', AWS_SECRET_ACCESS_KEY: 'test', AWS_REGION: 'us-east-1',
      ANTHROPIC_MODEL: 'model', PROJECT_ROOT: process.cwd()
    })).not.toThrow();
  });

  it('rejects missing authentication without exposing values', () => {
    expect(() => validateEnvironment({ ANTHROPIC_MODEL: 'model', PROJECT_ROOT: process.cwd() }))
      .toThrow('Authentication missing');
  });
});
