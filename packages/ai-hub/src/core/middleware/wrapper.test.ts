import type { LanguageModelV4, LanguageModelV4Middleware } from '@ai-sdk/provider';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  composeMiddlewares,
  createLoggingMiddleware,
  createMetricsMiddleware,
  createRetryMiddleware,
  wrapWithMiddlewares,
} from './wrapper';

vi.mock('ai', () => ({
  wrapLanguageModel: vi.fn(({ model, middleware }) => ({
    ...model,
    wrapped: true,
    middleware,
  })),
}));

describe('wrapWithMiddlewares', () => {
  const mockModel = {
    specificationVersion: 'v4',
    provider: 'test',
    modelId: 'test-model',
    doGenerate: vi.fn(),
    doStream: vi.fn(),
  } as unknown as LanguageModelV4;

  const mockMiddleware: LanguageModelV4Middleware = {
    specificationVersion: 'v4',
    transformParams: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wraps model with single middleware', async () => {
    const { wrapLanguageModel } = await import('ai');
    const result = wrapWithMiddlewares(mockModel, mockMiddleware);

    expect(wrapLanguageModel).toHaveBeenCalledWith({
      model: mockModel,
      middleware: mockMiddleware,
    });
    expect(result).toHaveProperty('wrapped', true);
  });

  it('wraps model with array of middlewares', async () => {
    const { wrapLanguageModel } = await import('ai');
    const middleware1: LanguageModelV4Middleware = { specificationVersion: 'v4' };
    const middleware2: LanguageModelV4Middleware = { specificationVersion: 'v4' };

    wrapWithMiddlewares(mockModel, [middleware1, middleware2]);

    expect(wrapLanguageModel).toHaveBeenCalledTimes(2);
  });

  it('applies middlewares in order', async () => {
    const { wrapLanguageModel } = await import('ai');
    const calls: string[] = [];

    const middleware1: LanguageModelV4Middleware = { specificationVersion: 'v4' };
    const middleware2: LanguageModelV4Middleware = { specificationVersion: 'v4' };

    vi.mocked(wrapLanguageModel).mockImplementation(({ model, middleware }) => {
      calls.push(middleware === middleware1 ? 'first' : 'second');
      return { ...model, middleware } as unknown as LanguageModelV4;
    });

    wrapWithMiddlewares(mockModel, [middleware1, middleware2]);

    expect(calls).toEqual(['first', 'second']);
  });

  it('returns original model when array is empty', async () => {
    const result = wrapWithMiddlewares(mockModel, []);
    expect(result).toBe(mockModel);
  });
});

describe('createLoggingMiddleware', () => {
  it('creates middleware with default options', () => {
    const middleware = createLoggingMiddleware();

    expect(middleware.specificationVersion).toBe('v4');
    expect(middleware.transformParams).toBeDefined();
  });

  it('logs input when logInput is true', async () => {
    const logger = vi.fn();
    const middleware = createLoggingMiddleware({ logInput: true, logger });

    await middleware.transformParams?.({
      type: 'generate',
      params: { prompt: 'test' } as never,
      model: {} as LanguageModelV4,
    });

    expect(logger).toHaveBeenCalledWith('Model input:', { prompt: 'test' });
  });

  it('does not log when logInput is false', async () => {
    const logger = vi.fn();
    const middleware = createLoggingMiddleware({ logInput: false, logger });

    await middleware.transformParams?.({
      type: 'generate',
      params: { prompt: 'test' } as never,
      model: {} as LanguageModelV4,
    });

    expect(logger).not.toHaveBeenCalled();
  });

  it('uses console.log by default', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const middleware = createLoggingMiddleware();

    await middleware.transformParams?.({
      type: 'generate',
      params: { prompt: 'test' } as never,
      model: {} as LanguageModelV4,
    });

    expect(consoleSpy).toHaveBeenCalledWith('Model input:', { prompt: 'test' });
    consoleSpy.mockRestore();
  });

  it('returns params unchanged', async () => {
    const middleware = createLoggingMiddleware({ logInput: false });
    const params = { prompt: 'test', temperature: 0.7 } as never;

    const result = await middleware.transformParams?.({
      type: 'generate',
      params,
      model: {} as LanguageModelV4,
    });

    expect(result).toEqual(params);
  });
});

describe('createMetricsMiddleware', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates middleware with wrapGenerate', () => {
    const onMetrics = vi.fn();
    const middleware = createMetricsMiddleware(onMetrics);

    expect(middleware.specificationVersion).toBe('v4');
    expect(middleware.wrapGenerate).toBeDefined();
  });

  it('measures duration', async () => {
    const onMetrics = vi.fn();
    const middleware = createMetricsMiddleware(onMetrics);

    const doGenerate = vi.fn().mockImplementation(async () => {
      await vi.advanceTimersByTimeAsync(100);
      return {};
    });

    await middleware.wrapGenerate?.({ doGenerate } as never);

    expect(onMetrics).toHaveBeenCalledWith(expect.objectContaining({ duration: 100 }));
  });

  it('extracts usage from result', async () => {
    const onMetrics = vi.fn();
    const middleware = createMetricsMiddleware(onMetrics);

    const doGenerate = vi.fn().mockResolvedValue({
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    });

    await middleware.wrapGenerate?.({ doGenerate } as never);

    expect(onMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      }),
    );
  });

  it('handles missing usage', async () => {
    const onMetrics = vi.fn();
    const middleware = createMetricsMiddleware(onMetrics);

    const doGenerate = vi.fn().mockResolvedValue({});

    await middleware.wrapGenerate?.({ doGenerate } as never);

    expect(onMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        promptTokens: undefined,
        completionTokens: undefined,
        totalTokens: undefined,
      }),
    );
  });

  it('returns result from doGenerate', async () => {
    const onMetrics = vi.fn();
    const middleware = createMetricsMiddleware(onMetrics);
    const expected = { text: 'response' };

    const doGenerate = vi.fn().mockResolvedValue(expected);

    const result = await middleware.wrapGenerate?.({ doGenerate } as never);

    expect(result).toEqual(expected);
  });
});

describe('createRetryMiddleware', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates middleware with default options', () => {
    const middleware = createRetryMiddleware();

    expect(middleware.specificationVersion).toBe('v4');
    expect(middleware.wrapGenerate).toBeDefined();
  });

  it('returns result on success', async () => {
    const middleware = createRetryMiddleware();
    const expected = { text: 'response' };
    const doGenerate = vi.fn().mockResolvedValue(expected);

    const result = await middleware.wrapGenerate?.({ doGenerate } as never);

    expect(result).toEqual(expected);
    expect(doGenerate).toHaveBeenCalledTimes(1);
  });

  it('retries on rate limit error', async () => {
    const middleware = createRetryMiddleware({ maxRetries: 3, retryDelay: 100 });
    const doGenerate = vi
      .fn()
      .mockRejectedValueOnce(new Error('rate limit'))
      .mockResolvedValueOnce({ text: 'success' });

    const resultPromise = middleware.wrapGenerate?.({ doGenerate } as never);
    await vi.advanceTimersByTimeAsync(200);
    const result = await resultPromise;

    expect(result).toEqual({ text: 'success' });
    expect(doGenerate).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable errors', async () => {
    const middleware = createRetryMiddleware();
    const doGenerate = vi.fn().mockRejectedValue(new Error('invalid input'));

    await expect(middleware.wrapGenerate?.({ doGenerate } as never)).rejects.toThrow(
      'invalid input',
    );
    expect(doGenerate).toHaveBeenCalledTimes(1);
  });

  it('uses custom shouldRetry', async () => {
    const middleware = createRetryMiddleware({
      maxRetries: 3,
      retryDelay: 100,
      shouldRetry: (error) => error.message.includes('custom'),
    });

    const doGenerate = vi
      .fn()
      .mockRejectedValueOnce(new Error('custom error'))
      .mockResolvedValueOnce({ text: 'success' });

    const resultPromise = middleware.wrapGenerate?.({ doGenerate } as never);
    await vi.advanceTimersByTimeAsync(200);
    const result = await resultPromise;

    expect(result).toEqual({ text: 'success' });
  });

  it('throws after max retries', async () => {
    const middleware = createRetryMiddleware({ maxRetries: 2, retryDelay: 10 });
    const doGenerate = vi.fn().mockRejectedValue(new Error('rate limit'));

    await expect(middleware.wrapGenerate?.({ doGenerate } as never)).rejects.toThrow('rate limit');
    expect(doGenerate).toHaveBeenCalledTimes(2);
  });

  it('increases delay with each retry', async () => {
    const middleware = createRetryMiddleware({ maxRetries: 3, retryDelay: 100 });
    const doGenerate = vi
      .fn()
      .mockRejectedValueOnce(new Error('rate limit'))
      .mockRejectedValueOnce(new Error('rate limit'))
      .mockResolvedValueOnce({ text: 'success' });

    const resultPromise = middleware.wrapGenerate?.({ doGenerate } as never);

    // First retry after 100ms (100 * 1)
    await vi.advanceTimersByTimeAsync(100);
    expect(doGenerate).toHaveBeenCalledTimes(2);

    // Second retry after 200ms (100 * 2)
    await vi.advanceTimersByTimeAsync(200);
    expect(doGenerate).toHaveBeenCalledTimes(3);

    await resultPromise;
  });
});

describe('composeMiddlewares', () => {
  it('creates middleware with transformParams', () => {
    const middleware = composeMiddlewares();

    expect(middleware.specificationVersion).toBe('v4');
    expect(middleware.transformParams).toBeDefined();
    expect(middleware.wrapGenerate).toBeDefined();
    expect(middleware.wrapStream).toBeDefined();
  });

  it('chains transformParams in order', async () => {
    const order: string[] = [];

    const middleware1: LanguageModelV4Middleware = {
      specificationVersion: 'v4',
      transformParams: async ({ params }) => {
        order.push('first');
        return { ...params, first: true };
      },
    };

    const middleware2: LanguageModelV4Middleware = {
      specificationVersion: 'v4',
      transformParams: async ({ params }) => {
        order.push('second');
        return { ...params, second: true };
      },
    };

    const composed = composeMiddlewares(middleware1, middleware2);

    const result = await composed.transformParams?.({
      type: 'generate',
      params: { original: true } as never,
      model: {} as LanguageModelV4,
    });

    expect(order).toEqual(['first', 'second']);
    expect(result).toEqual({ original: true, first: true, second: true });
  });

  it('skips middlewares without transformParams', async () => {
    const middleware1: LanguageModelV4Middleware = {
      specificationVersion: 'v4',
    };

    const middleware2: LanguageModelV4Middleware = {
      specificationVersion: 'v4',
      transformParams: async ({ params }) => ({ ...params, modified: true }),
    };

    const composed = composeMiddlewares(middleware1, middleware2);

    const result = await composed.transformParams?.({
      type: 'generate',
      params: { original: true } as never,
      model: {} as LanguageModelV4,
    });

    expect(result).toEqual({ original: true, modified: true });
  });

  it('chains wrapGenerate in order (first outer, last inner)', async () => {
    const order: string[] = [];

    const middleware1: LanguageModelV4Middleware = {
      specificationVersion: 'v4',
      wrapGenerate: async ({ doGenerate }) => {
        order.push('first-before');
        const result = await doGenerate();
        order.push('first-after');
        return result;
      },
    };

    const middleware2: LanguageModelV4Middleware = {
      specificationVersion: 'v4',
      wrapGenerate: async ({ doGenerate }) => {
        order.push('second-before');
        const result = await doGenerate();
        order.push('second-after');
        return result;
      },
    };

    const composed = composeMiddlewares(middleware1, middleware2);

    const doGenerate = vi.fn().mockImplementation(async () => {
      order.push('generate');
      return { text: 'result' };
    });

    await composed.wrapGenerate?.({ doGenerate } as never);

    expect(order).toEqual([
      'first-before',
      'second-before',
      'generate',
      'second-after',
      'first-after',
    ]);
  });

  it('chains wrapStream in order', async () => {
    const order: string[] = [];

    const middleware1: LanguageModelV4Middleware = {
      specificationVersion: 'v4',
      wrapStream: async ({ doStream }) => {
        order.push('first-before');
        const result = await doStream();
        order.push('first-after');
        return result;
      },
    };

    const middleware2: LanguageModelV4Middleware = {
      specificationVersion: 'v4',
      wrapStream: async ({ doStream }) => {
        order.push('second-before');
        const result = await doStream();
        order.push('second-after');
        return result;
      },
    };

    const composed = composeMiddlewares(middleware1, middleware2);

    const doStream = vi.fn().mockImplementation(async () => {
      order.push('stream');
      return { stream: 'result' };
    });

    await composed.wrapStream?.({ doStream } as never);

    expect(order).toEqual([
      'first-before',
      'second-before',
      'stream',
      'second-after',
      'first-after',
    ]);
  });

  it('skips middlewares without wrapGenerate', async () => {
    const middleware1: LanguageModelV4Middleware = {
      specificationVersion: 'v4',
    };

    const middleware2: LanguageModelV4Middleware = {
      specificationVersion: 'v4',
      wrapGenerate: async ({ doGenerate }) => {
        const result = await doGenerate();
        return { ...result, modified: true };
      },
    };

    const composed = composeMiddlewares(middleware1, middleware2);

    const doGenerate = vi.fn().mockResolvedValue({ original: true });

    const result = await composed.wrapGenerate?.({ doGenerate } as never);

    expect(result).toEqual({ original: true, modified: true });
  });

  it('works with empty middlewares array', async () => {
    const composed = composeMiddlewares();

    const doGenerate = vi.fn().mockResolvedValue({ text: 'result' });

    const result = await composed.wrapGenerate?.({ doGenerate } as never);

    expect(result).toEqual({ text: 'result' });
    expect(doGenerate).toHaveBeenCalledTimes(1);
  });
});
