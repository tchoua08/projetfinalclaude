import { describe, expect, it } from 'vitest';
import { reviewAgents } from '../src/agents/index.js';

describe('review agents', () => {
  it('exposes Skill to every specialist', () => {
    for (const agent of Object.values(reviewAgents)) {
      expect(agent.tools).toContain('Skill');
    }
  });
});
