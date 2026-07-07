import { createAnthropic } from '@ai-sdk/anthropic';
import { createAzure } from '@ai-sdk/azure';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createVertex } from '@ai-sdk/google-vertex';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createXai } from '@ai-sdk/xai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { ProviderInstance, ProviderOptions } from '../types/provider';
import { ConfigurationError, ProviderError } from '../utils/errors';
import { registry } from './registry';

export class ConfigurableBuilder {
  private options: ProviderOptions = {};

  constructor(private providerId: string) {}

  withApiKey(apiKey: string): this {
    this.options.apiKey = apiKey;
    return this;
  }

  withBaseURL(baseURL: string): this {
    this.options.baseURL = baseURL;
    return this;
  }

  withHeaders(headers: Record<string, string>): this {
    this.options.headers = { ...this.options.headers, ...headers };
    return this;
  }

  withOrganization(organization: string): this {
    this.options.organization = organization;
    return this;
  }

  withProject(project: string): this {
    this.options.project = project;
    return this;
  }

  withAzureConfig(config: { resourceName: string; apiVersion?: string }): this {
    this.options.resourceName = config.resourceName;
    this.options.apiVersion = config.apiVersion || '2024-02-01';
    return this;
  }

  withVertexConfig(config: { project: string; location?: string }): this {
    this.options.project = config.project;
    this.options.region = config.location || 'us-central1';
    return this;
  }

  withAnthropicFormat(useAnthropicFormat = true): this {
    this.options.useAnthropicFormat = useAnthropicFormat;
    return this;
  }

  withRetry(config: {
    maxRetries?: number;
    backoff?: 'linear' | 'exponential';
    initialDelay?: number;
  }): this {
    this.options.headers = {
      ...this.options.headers,
      'x-max-retries': String(config.maxRetries || 3),
      'x-backoff-strategy': config.backoff || 'exponential',
      'x-initial-delay': String(config.initialDelay || 1000),
    };
    return this;
  }

  build(): ProviderInstance {
    const config = registry.get(this.providerId);

    if (!config) {
      throw new ProviderError(`Provider ${this.providerId} not found in registry`, this.providerId);
    }

    if (!this.options.apiKey && config.type !== 'custom') {
      throw new ConfigurationError(`API key is required for provider ${this.providerId}`);
    }

    return ProviderBuilder.createProviderInstance(this.providerId, this.options);
  }
}

/**
 * Creates a proper ProviderInstance wrapper around an AI SDK provider.
 * AI SDK providers are special callable objects/proxies where Object.assign
 * silently fails to add new properties. This function creates a clean wrapper
 * that properly exposes all required ProviderInstance properties.
 */
const attachProviderId = <T extends { languageModel: ProviderInstance['languageModel'] }>(
  providerId: string,
  provider: T,
  metadata?: Pick<ProviderInstance, 'apiKey' | 'baseURL'>,
): ProviderInstance => ({
  providerId,
  name: providerId,
  apiKey: metadata?.apiKey,
  baseURL: metadata?.baseURL,
  languageModel: (modelId: string) => provider.languageModel(modelId),
});

export const ProviderBuilder = {
  openai(apiKey: string, baseURL?: string): ProviderInstance {
    const provider = createOpenAI({
      apiKey,
      baseURL,
    });
    return attachProviderId('openai', provider, { apiKey, baseURL });
  },

  anthropic(apiKey: string, baseURL?: string): ProviderInstance {
    const provider = createAnthropic({
      apiKey,
      baseURL,
    });
    return attachProviderId('anthropic', provider, { apiKey, baseURL });
  },

  azure(apiKey: string, resourceName: string, apiVersion = '2024-02-01'): ProviderInstance {
    const provider = createAzure({
      apiKey,
      resourceName,
      apiVersion,
    });
    return attachProviderId('azure', provider, { apiKey });
  },

  vertex(project: string, location = 'us-central1'): ProviderInstance {
    const provider = createVertex({
      project,
      location,
    });
    return attachProviderId('vertex', provider);
  },

  xai(apiKey: string, baseURL?: string): ProviderInstance {
    const provider = createXai({
      apiKey,
      baseURL,
    });
    return attachProviderId('xai', provider, { apiKey, baseURL });
  },

  deepseek(apiKey: string, baseURL?: string): ProviderInstance {
    const provider = createDeepSeek({
      apiKey,
      baseURL,
    });
    return attachProviderId('deepseek', provider, { apiKey, baseURL });
  },

  mistral(apiKey: string, baseURL?: string): ProviderInstance {
    const provider = createMistral({
      apiKey,
      baseURL,
    });
    return attachProviderId('mistral', provider, { apiKey, baseURL });
  },

  openrouter(apiKey: string, baseURL?: string): ProviderInstance {
    const provider = createOpenRouter({
      apiKey,
      baseURL,
    });
    return attachProviderId('openrouter', provider, { apiKey, baseURL });
  },

  compatible(
    name: string,
    apiKey: string,
    baseURL: string,
    headers?: Record<string, string>,
  ): ProviderInstance {
    const provider = createOpenAICompatible({
      name,
      apiKey,
      baseURL,
      headers,
    });
    return attachProviderId(name, provider, { apiKey, baseURL });
  },

  create(providerId: string): ConfigurableBuilder {
    return new ConfigurableBuilder(providerId);
  },

  createProviderInstance(providerId: string, options: ProviderOptions): ProviderInstance {
    const config = registry.get(providerId);

    if (!config) {
      throw new ProviderError(`Provider ${providerId} not found in registry`, providerId);
    }

    const cacheKey = `${providerId}_${JSON.stringify(options)}`;
    const cached = registry.getCachedInstance(cacheKey);
    if (cached) {
      return cached;
    }

    let instance: ProviderInstance;

    if (config.type === 'official' && config.creator) {
      instance = config.creator(options);
    } else if (config.type === 'compatible' && config.compatibleConfig) {
      const baseURL =
        options.useAnthropicFormat && config.compatibleConfig.alternativeBaseURL
          ? config.compatibleConfig.alternativeBaseURL
          : config.compatibleConfig.baseURL;

      const provider = createOpenAICompatible({
        name: config.name,
        apiKey: options.apiKey,
        baseURL: options.baseURL || baseURL,
        headers: {
          ...config.compatibleConfig.defaultHeaders,
          ...options.headers,
        },
      });
      instance = attachProviderId(config.id, provider, {
        apiKey: options.apiKey,
        baseURL: options.baseURL || baseURL,
      });
    } else {
      throw new ConfigurationError(
        `Cannot create provider ${providerId}: missing creator or compatible config`,
      );
    }

    registry.cacheInstance(cacheKey, instance);
    return instance;
  },
} as const;
