import type { LanguageModelV4Middleware } from '@ai-sdk/provider';
import type { generateText, ModelMessage, streamText } from 'ai';
import type { AiPlugin } from './plugin';
import type { ProviderInstance } from './provider';

type ProviderLike = {
  providerId?: string;
  name?: string;
  languageModel?: ProviderInstance['languageModel'];
  chat?: ProviderInstance['languageModel'];
};

type GenerateTextResult = Awaited<ReturnType<typeof generateText>>;
type StreamTextResult = ReturnType<typeof streamText>;

type ComparisonResultPayload =
  | GenerateTextResult
  | StreamTextResult
  | {
      text: string;
      usage?: Awaited<StreamTextResult['usage']>;
    };

export interface RuntimeConfig {
  providerId: string;
  providerOptions?: Record<string, unknown>;
  plugins?: AiPlugin[];
  middlewares?: LanguageModelV4Middleware[];
}

export interface StreamTextParams {
  model: string;
  messages: ModelMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  seed?: number;
  system?: string;
}

export interface GenerateTextParams extends StreamTextParams {}

export interface GenerateObjectParams<_T = unknown> extends StreamTextParams {
  schema: unknown;
  mode?: 'json' | 'tool';
}

export interface StreamObjectParams<T = unknown> extends GenerateObjectParams<T> {}

export interface ModelComparisonConfig {
  provider: ProviderInstance | ProviderLike;
  model: string;
  options?: {
    temperature?: number;
    maxTokens?: number;
    [key: string]: unknown;
  };
}

export interface ModelComparisonResult {
  provider: string;
  model: string;
  result?: ComparisonResultPayload;
  error?: Error;
  metrics?: ModelMetrics;
  status: 'success' | 'failed' | 'cancelled';
}

export interface ModelMetrics {
  timeToFirstToken?: number;
  totalTime: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  tokensPerSecond?: number;
}

export interface ArenaOptions {
  controller?: AbortController;
  onProgress?: (provider: string, model: string, chunk: string) => void;
  plugins?: AiPlugin[];
  streaming?: boolean;
  stopOnError?: boolean;
  retryOptions?: RetryOptions;
}

export interface RetryOptions {
  maxAttempts: number;
  backoff?: 'linear' | 'exponential';
  initialDelay?: number;
  maxDelay?: number;
  retryableErrors?: string[];
}

// ============================================================================
// Video Generation Types
// ============================================================================

export interface VideoGenerationParams {
  model: string;
  prompt: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface VideoGenerationResult {
  url: string;
  mimeType: string;
  thumbnailUrl?: string;
  duration?: number;
}

export type VideoStreamEvent =
  | { type: 'heartbeat' }
  | { type: 'video'; video: VideoGenerationResult }
  | { type: 'error'; error: string };
