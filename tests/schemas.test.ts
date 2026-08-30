import { describe, expect, it } from 'vitest';
import {
  CodeQualityResultSchema,
  RefactoringSuggestionSchema,
  ReviewReportJSONSchema,
  TestCoverageResultSchema
} from '../src/types/index.js';

describe('structured output schemas', () => {
  it('rejects out-of-range quality scores', () => {
    expect(CodeQualityResultSchema.safeParse({ file: 'a.ts', issues: [], overallScore: 101, summary: 'x' }).success).toBe(false);
  });

  it('accepts empty, valid test and refactoring results', () => {
    expect(TestCoverageResultSchema.safeParse({
      file: 'a.ts', hasTests: false, testFiles: [], untestedPaths: [], coverageEstimate: 0, summary: 'No tests.'
    }).success).toBe(true);
    expect(RefactoringSuggestionSchema.safeParse({ file: 'a.ts', suggestions: [], summary: 'None.' }).success).toBe(true);
  });

  it('exports a JSON schema usable by structured outputs', () => {
    expect(ReviewReportJSONSchema).toMatchObject({ type: 'object' });
  });
});
