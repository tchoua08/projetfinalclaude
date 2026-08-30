import { describe, expect, it } from 'vitest';
import { ReportGenerator } from '../src/utils/report-generator.js';
import type { ReviewReport } from '../src/types/index.js';

const report: ReviewReport = {
  pullRequest: { owner: 'a&b', repo: 'repo', number: 1 },
  fileReviews: [{
    file: 'src/<unsafe>.ts',
    codeQuality: {
      file: 'src/<unsafe>.ts', overallScore: 80, summary: 'Summary',
      issues: [{ line: 4, severity: 'high', category: 'security', description: '<script>', suggestion: 'Escape output' }]
    },
    testCoverage: { file: 'src/<unsafe>.ts', hasTests: false, testFiles: [], coverageEstimate: 20, summary: 'Low', untestedPaths: [] },
    refactorings: { file: 'src/<unsafe>.ts', suggestions: [], summary: 'None' }
  }],
  summary: { totalFiles: 1, overallScore: 80, criticalIssues: 0, highPriorityTests: 0, refactoringOpportunities: 0 },
  recommendations: [],
  metadata: { analyzedAt: '2026-08-30T00:00:00Z', duration: 20, agentVersions: {} }
};

describe('ReportGenerator', () => {
  const generator = new ReportGenerator();

  it('generates parseable JSON', () => {
    expect(JSON.parse(generator.generateJSONReport(report))).toEqual(report);
  });

  it('generates detailed Markdown', () => {
    expect(generator.generateMarkdownReport(report)).toContain('src/<unsafe>.ts');
  });

  it('generates escaped, detailed HTML', () => {
    const html = generator.generateHTMLReport(report);
    expect(html).toContain('src/&lt;unsafe&gt;.ts');
    expect(html).not.toContain('<script>');
    expect(html).toContain('Quality issues');
  });
});
