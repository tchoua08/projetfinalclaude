import { describe, expect, it } from 'vitest';
import { RateLimiter, withRateLimit } from '../src/utils/rate-limiter.js';

describe('RateLimiter', () => {
  it('tracks requests, tokens, and releases concurrency slots', async () => {
    const limiter = new RateLimiter({ maxRequestsPerMinute: 5, maxTokensPerMinute: 100, maxConcurrent: 1 });
    await limiter.acquire(20);
    expect(limiter.getStatus()).toMatchObject({ activeRequests: 1, requestsInWindow: 1, tokensInWindow: 20 });
    limiter.release(15);
    expect(limiter.getStatus()).toMatchObject({ activeRequests: 0, tokensInWindow: 15 });
  });

  it('always releases the slot when a wrapped operation fails', async () => {
    const limiter = new RateLimiter({ maxRequestsPerMinute: 5, maxTokensPerMinute: 100, maxConcurrent: 1 });
    await expect(withRateLimit(limiter, async () => { throw new Error('failed'); }, 10)).rejects.toThrow('failed');
    expect(limiter.getStatus().activeRequests).toBe(0);
  });

  it('rejects a request larger than the token window', async () => {
    const limiter = new RateLimiter({ maxTokensPerMinute: 10 });
    await expect(limiter.acquire(11)).rejects.toThrow('exceed');
  });
});
