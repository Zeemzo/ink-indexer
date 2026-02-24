import { describe, it, expect, vi } from 'vitest';
import { exponentialRetry } from '../../src/lib/retry.js';

describe('exponentialRetry', () => {
  it('should return the result on first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await exponentialRetry(fn, { baseDelayMs: 1 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and return result on success', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const result = await exponentialRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 1,
    });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max retries exceeded', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    await expect(
      exponentialRetry(fn, { maxRetries: 2, baseDelayMs: 1 })
    ).rejects.toThrow('always fails');

    // Initial attempt + 2 retries = 3 calls
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should use default options when none provided', async () => {
    const fn = vi.fn().mockResolvedValue(42);

    const result = await exponentialRetry(fn);

    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should respect maxRetries of 0 (no retries)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(
      exponentialRetry(fn, { maxRetries: 0, baseDelayMs: 1 })
    ).rejects.toThrow('fail');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should preserve the original error type', async () => {
    class CustomError extends Error {
      code: string;
      constructor(message: string, code: string) {
        super(message);
        this.code = code;
      }
    }

    const fn = vi.fn().mockRejectedValue(new CustomError('rpc error', 'RPC_TIMEOUT'));

    try {
      await exponentialRetry(fn, { maxRetries: 1, baseDelayMs: 1 });
      expect.fail('should have thrown');
    } catch (error: any) {
      expect(error).toBeInstanceOf(CustomError);
      expect(error.code).toBe('RPC_TIMEOUT');
    }
  });

  it('should handle async functions that return different types', async () => {
    const fnNumber = vi.fn().mockResolvedValue(123);
    const fnObject = vi.fn().mockResolvedValue({ block: 100 });
    const fnArray = vi.fn().mockResolvedValue([1, 2, 3]);

    expect(await exponentialRetry(fnNumber, { baseDelayMs: 1 })).toBe(123);
    expect(await exponentialRetry(fnObject, { baseDelayMs: 1 })).toEqual({ block: 100 });
    expect(await exponentialRetry(fnArray, { baseDelayMs: 1 })).toEqual([1, 2, 3]);
  });

  it('should retry the correct number of times with exponential delays', async () => {
    const callTimes: number[] = [];
    const fn = vi.fn().mockImplementation(async () => {
      callTimes.push(Date.now());
      throw new Error('fail');
    });

    const startTime = Date.now();

    await expect(
      exponentialRetry(fn, {
        maxRetries: 2,
        baseDelayMs: 50,
        backoffMultiplier: 2,
        maxDelayMs: 5000,
      })
    ).rejects.toThrow('fail');

    expect(fn).toHaveBeenCalledTimes(3);

    // Verify delays are roughly exponential (50ms, 100ms)
    // Allow some tolerance for timer imprecision
    if (callTimes.length >= 3) {
      const delay1 = callTimes[1] - callTimes[0];
      const delay2 = callTimes[2] - callTimes[1];
      expect(delay1).toBeGreaterThanOrEqual(30); // ~50ms with tolerance
      expect(delay2).toBeGreaterThanOrEqual(60); // ~100ms with tolerance
    }
  });
});
