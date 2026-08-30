import { describe, expect, it, vi } from 'vitest';
import { ErrorCodes, ReviewError, withRetry, withTimeout } from '../src/utils/error-handler.js';

describe('error handling utilities', () => {
  it('retries transient failures and returns the eventual value', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValue('ok');
    await expect(withRetry(operation, 1, 0)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });

  it('wraps exhausted retries in a ReviewError', async () => {
    await expect(withRetry(async () => { throw new Error('down'); }, 0, 0))
      .rejects.toMatchObject({ code: ErrorCodes.RETRY_EXHAUSTED });
  });

  it('times out slow operations with metadata', async () => {
    await expect(withTimeout(() => new Promise(() => undefined), 5))
      .rejects.toEqual(expect.objectContaining<Partial<ReviewError>>({ code: ErrorCodes.AGENT_TIMEOUT }));
  });
});
