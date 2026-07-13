import { describe, expect, it } from 'vitest';
import { getErrorInfo, isRetryableError, VideoError } from './errors';

describe('VideoError', () => {
  it('constructs with all fields and defaults retryable to false', () => {
    const error = new VideoError({
      code: 'PROVIDER_ERROR',
      message: 'boom',
      provider: 'openai',
      model: 'sora-2',
      cause: { detail: 1 },
    });

    expect(error.name).toBe('VideoError');
    expect(error.message).toBe('boom');
    expect(error.code).toBe('PROVIDER_ERROR');
    expect(error.provider).toBe('openai');
    expect(error.model).toBe('sora-2');
    expect(error.retryable).toBe(false);
    expect(error.cause).toEqual({ detail: 1 });
  });

  it('toInfo serializes fields', () => {
    const error = new VideoError({
      code: 'TIMEOUT',
      message: 'timed out',
      provider: 'minimax',
      retryable: true,
    });

    expect(error.toInfo()).toEqual({
      code: 'TIMEOUT',
      message: 'timed out',
      provider: 'minimax',
      model: undefined,
      retryable: true,
      cause: undefined,
    });
  });

  describe('from', () => {
    it('returns the same instance for VideoError', () => {
      const original = VideoError.timeout('x');
      expect(VideoError.from(original)).toBe(original);
    });

    it('maps timeout messages', () => {
      const error = VideoError.from(new Error('connection timeout'), { provider: 'openai' });
      expect(error.code).toBe('TIMEOUT');
      expect(error.retryable).toBe(true);
      expect(error.provider).toBe('openai');
    });

    it('maps ETIMEDOUT messages', () => {
      const error = VideoError.from(new Error('ETIMEDOUT'));
      expect(error.code).toBe('TIMEOUT');
    });

    it('maps network messages', () => {
      const error = VideoError.from(new Error('network unreachable'));
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.retryable).toBe(true);
    });

    it('maps ECONNREFUSED messages', () => {
      const error = VideoError.from(new Error('ECONNREFUSED'));
      expect(error.code).toBe('NETWORK_ERROR');
    });

    it('maps rate limit messages', () => {
      const error = VideoError.from(new Error('rate limit exceeded'));
      expect(error.code).toBe('RATE_LIMIT');
      expect(error.retryable).toBe(true);
    });

    it('maps 429 messages', () => {
      const error = VideoError.from(new Error('HTTP 429'));
      expect(error.code).toBe('RATE_LIMIT');
    });

    it('maps unknown Error messages', () => {
      const error = VideoError.from(new Error('something else'));
      expect(error.code).toBe('UNKNOWN');
      expect(error.retryable).toBe(false);
      expect(error.message).toBe('something else');
    });

    it('maps non-Error values', () => {
      const error = VideoError.from('plain string');
      expect(error.code).toBe('UNKNOWN');
      expect(error.message).toBe('plain string');
    });
  });

  it('creates specialized factory errors', () => {
    expect(VideoError.invalidParams('bad', 'openai').code).toBe('INVALID_PARAMS');
    expect(VideoError.providerError('fail', 'minimax', { x: 1 }).provider).toBe('minimax');
    expect(VideoError.timeout('slow').retryable).toBe(true);
    expect(VideoError.pollTimeout('task-1', 'vidu').message).toContain('task-1');
    expect(VideoError.modelNotFound('sora-2', 'openai').model).toBe('sora-2');
    expect(VideoError.providerNotFound('missing').code).toBe('PROVIDER_NOT_FOUND');
    expect(VideoError.generationFailed('nope', 'kling', 'kling-v1').code).toBe('GENERATION_FAILED');
    expect(VideoError.contentPolicy('blocked', 'google').code).toBe('CONTENT_POLICY');
    expect(VideoError.insufficientCredits('openai').message).toContain('openai');
  });
});

describe('isRetryableError', () => {
  it('returns retryable flag for VideoError and false otherwise', () => {
    expect(isRetryableError(VideoError.timeout('x'))).toBe(true);
    expect(isRetryableError(VideoError.invalidParams('x'))).toBe(false);
    expect(isRetryableError(new Error('x'))).toBe(false);
    expect(isRetryableError('x')).toBe(false);
  });
});

describe('getErrorInfo', () => {
  it('returns info for unknown errors with defaults', () => {
    const info = getErrorInfo(new Error('rate limit hit'), { provider: 'openai', model: 'sora-2' });
    expect(info.code).toBe('RATE_LIMIT');
    expect(info.provider).toBe('openai');
    expect(info.model).toBe('sora-2');
  });
});
