import type { LanguageModelV4, LanguageModelV4Middleware } from '@ai-sdk/provider';
import { wrapLanguageModel } from 'ai';

/**
 * Wraps a language model with middlewares
 */
export function wrapWithMiddlewares(
  model: LanguageModelV4,
  middlewares: LanguageModelV4Middleware | LanguageModelV4Middleware[],
): LanguageModelV4 {
  if (Array.isArray(middlewares)) {
    // Apply middlewares in order
    let wrappedModel = model;
    for (const middleware of middlewares) {
      wrappedModel = wrapLanguageModel({
        model: wrappedModel,
        middleware,
      });
    }
    return wrappedModel;
  }

  return wrapLanguageModel({
    model,
    middleware: middlewares,
  });
}

/**
 * Creates a middleware that logs all model calls
 */
export function createLoggingMiddleware(
  options: {
    logInput?: boolean;
    logOutput?: boolean;
    logger?: (message: string, data?: unknown) => void;
  } = {},
): LanguageModelV4Middleware {
  const { logInput = true, logger = console.log } = options;

  return {
    specificationVersion: 'v4',
    transformParams: async ({ params }) => {
      if (logInput) {
        logger('Model input:', params);
      }
      return params;
    },
  };
}

/**
 * Creates a middleware that tracks performance metrics
 */
export function createMetricsMiddleware(
  onMetrics: (metrics: {
    duration: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  }) => void,
): LanguageModelV4Middleware {
  return {
    specificationVersion: 'v4',
    wrapGenerate: async ({ doGenerate }) => {
      const startTime = Date.now();
      const result = await doGenerate();

      const duration = Date.now() - startTime;
      const usage =
        result && typeof result === 'object' && 'usage' in result
          ? (
              result as {
                usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
              }
            ).usage
          : undefined;

      onMetrics({
        duration,
        promptTokens: usage?.promptTokens,
        completionTokens: usage?.completionTokens,
        totalTokens: usage?.totalTokens,
      });

      return result;
    },
  };
}

/**
 * Creates a middleware that adds retry logic
 */
export function createRetryMiddleware(
  options: {
    maxRetries?: number;
    retryDelay?: number;
    shouldRetry?: (error: Error) => boolean;
  } = {},
): LanguageModelV4Middleware {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    shouldRetry = (error) => error.message.includes('rate limit'),
  } = options;

  return {
    specificationVersion: 'v4',
    wrapGenerate: async ({ doGenerate }) => {
      let lastError: Error | undefined;

      for (let i = 0; i < maxRetries; i++) {
        try {
          return await doGenerate();
        } catch (error) {
          lastError = error as Error;

          if (!shouldRetry(lastError) || i === maxRetries - 1) {
            throw lastError;
          }

          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, retryDelay * (i + 1)));
        }
      }

      throw lastError;
    },
  };
}

/**
 * Composes multiple middlewares into one
 */
export function composeMiddlewares(
  ...middlewares: LanguageModelV4Middleware[]
): LanguageModelV4Middleware {
  type GenerateWrapper = NonNullable<LanguageModelV4Middleware['wrapGenerate']>;
  type StreamWrapper = NonNullable<LanguageModelV4Middleware['wrapStream']>;
  type GenerateOptions = Parameters<GenerateWrapper>[0];
  type StreamOptions = Parameters<StreamWrapper>[0];
  type GenerateHandler = (options: GenerateOptions) => ReturnType<GenerateWrapper>;
  type StreamHandler = (options: StreamOptions) => ReturnType<StreamWrapper>;

  const wrapGenerate = middlewares.reduceRight<GenerateHandler>(
    (next, middleware) => {
      const middlewareWrapGenerate = middleware.wrapGenerate;
      if (!middlewareWrapGenerate) {
        return next;
      }

      return async (options) =>
        middlewareWrapGenerate({
          ...options,
          doGenerate: () => next(options),
        });
    },
    async (options) => Promise.resolve(options.doGenerate()),
  );

  const wrapStream = middlewares.reduceRight<StreamHandler>(
    (next, middleware) => {
      const middlewareWrapStream = middleware.wrapStream;
      if (!middlewareWrapStream) {
        return next;
      }

      return async (options) =>
        middlewareWrapStream({
          ...options,
          doStream: () => next(options),
        });
    },
    async (options) => Promise.resolve(options.doStream()),
  );

  return {
    specificationVersion: 'v4',
    transformParams: async ({ type, params, model }) => {
      let result = params;

      for (const middleware of middlewares) {
        if (middleware.transformParams) {
          result = await middleware.transformParams({ type, params: result, model });
        }
      }

      return result;
    },
    wrapGenerate,
    wrapStream,
  };
}
