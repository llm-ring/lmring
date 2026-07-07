import { createAnthropic } from '@ai-sdk/anthropic';
import { createAzure } from '@ai-sdk/azure';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createVertex } from '@ai-sdk/google-vertex';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';
import { createXai } from '@ai-sdk/xai';
import {
  getProviderMetadata,
  OFFICIAL_PROVIDER_METADATA,
  PROVIDER_ENDPOINTS,
} from '@lmring/model-depot/providers';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { ProviderConfig, ProviderInstance, ProviderOptions } from '../../types/provider';

type ProviderLike = {
  languageModel: ProviderInstance['languageModel'];
  chat?: ProviderInstance['languageModel'];
};

function wrapProvider<T extends ProviderLike>(
  providerId: string,
  creator: (options?: ProviderOptions) => T,
): (options: ProviderOptions) => ProviderInstance {
  return (options: ProviderOptions) => {
    const provider = creator(options);
    return {
      ...provider,
      providerId,
    };
  };
}

const SDK_CREATORS: Record<string, (options: ProviderOptions) => ProviderInstance> = {
  openai: wrapProvider('openai', createOpenAI),
  anthropic: wrapProvider('anthropic', createAnthropic),
  azure: wrapProvider('azure', createAzure),
  vertex: wrapProvider('vertex', createVertex),
  xai: wrapProvider('xai', createXai),
  deepseek: wrapProvider('deepseek', createDeepSeek),
  mistral: wrapProvider('mistral', createMistral),
  openrouter: wrapProvider('openrouter', createOpenRouter),
};

export const OFFICIAL_PROVIDERS: ProviderConfig[] = OFFICIAL_PROVIDER_METADATA.map((metadata) => {
  const creator = SDK_CREATORS[metadata.id];
  const endpoint = PROVIDER_ENDPOINTS[metadata.id];

  return {
    id: metadata.id,
    name: metadata.name,
    type: metadata.type,
    creator,
    compatibleConfig: endpoint,
    supportsStreaming: metadata.supportsStreaming,
    supportsStructuredOutput: metadata.supportsStructuredOutput,
    supportsVision: metadata.supportsVision,
    supportsFunctionCalling: metadata.supportsFunctionCalling,
  };
});

const INTERNATIONAL_COMPATIBLE_IDS = [
  'groq',
  'perplexity',
  'cohere',
  'togetherai',
  'fireworksai',
  'sambanova',
];

export const INTERNATIONAL_COMPATIBLE_PROVIDERS: ProviderConfig[] =
  INTERNATIONAL_COMPATIBLE_IDS.map((id) => {
    const metadata = getProviderMetadata(id);
    const endpoint = PROVIDER_ENDPOINTS[id];

    if (!metadata) {
      throw new Error(`Provider metadata not found for ${id}`);
    }

    return {
      id: metadata.id,
      name: metadata.name,
      type: metadata.type,
      compatibleConfig: endpoint,
      supportsStreaming: metadata.supportsStreaming,
      supportsStructuredOutput: metadata.supportsStructuredOutput,
      supportsVision: metadata.supportsVision,
      supportsFunctionCalling: metadata.supportsFunctionCalling,
    };
  });
