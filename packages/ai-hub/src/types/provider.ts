import type { LanguageModelV4 } from '@ai-sdk/provider';

export interface ProviderInstance {
  readonly providerId: string;
  readonly apiKey?: string;
  readonly baseURL?: string;
  readonly name?: string;
  languageModel(modelId: string): LanguageModelV4;
}

export interface ModelConfig {
  id: string;
  name?: string;
  supportedFormats?: Array<'openai' | 'anthropic'>;
}

export interface ProviderConfig {
  id: string;
  name: string;
  description?: string;
  type: 'official' | 'compatible' | 'custom';
  creator?: (options: ProviderOptions) => ProviderInstance;
  compatibleConfig?: {
    baseURL: string;
    alternativeBaseURL?: string;
    defaultHeaders?: Record<string, string>;
  };
  models?: ModelConfig[];
  supportsStreaming?: boolean;
  supportsStructuredOutput?: boolean;
  supportsVision?: boolean;
  supportsFunctionCalling?: boolean;
}

export interface ProviderOptions {
  apiKey?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  organization?: string;
  project?: string;
  resourceName?: string;
  apiVersion?: string;
  region?: string;
  useAnthropicFormat?: boolean;
}

export interface ResolvedModel {
  providerId: string;
  modelId: string;
  format: 'openai' | 'anthropic';
  model: LanguageModelV4;
}
