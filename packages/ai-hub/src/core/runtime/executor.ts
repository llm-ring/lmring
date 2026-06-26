import type { LanguageModelV4, LanguageModelV4Middleware } from '@ai-sdk/provider';
import { generateText as aiGenerateText, streamText as aiStreamText, Output } from 'ai';
import type { AiPlugin, PluginContext } from '../../types/plugin';
import type { ProviderInstance } from '../../types/provider';
import type {
  GenerateObjectParams,
  GenerateTextParams,
  StreamObjectParams,
  StreamTextParams,
} from '../../types/runtime';
import { ModelResolutionError } from '../../utils/errors';
import { wrapWithMiddlewares } from '../middleware/wrapper';
import { PluginEngine } from '../plugins/engine';

type ProviderLike = {
  providerId?: string;
  name?: string;
  languageModel?: ProviderInstance['languageModel'];
  chat?: ProviderInstance['languageModel'];
};

type ProviderSource = ProviderInstance | LanguageModelV4 | ProviderLike;

type StreamTextResponse = Awaited<ReturnType<typeof aiStreamText>>;
type GenerateTextResponse = Awaited<ReturnType<typeof aiGenerateText>>;

// For backward compatibility, generateObject/streamObject now use generateText/streamText with Output.object()
// The return types are now the same as their text counterparts
type GenerateObjectResponse = GenerateTextResponse;
type StreamObjectResponse = StreamTextResponse;

export class RuntimeExecutor {
  private engine: PluginEngine;
  private providerId: string;
  private middlewares: LanguageModelV4Middleware[];

  constructor(
    private provider: ProviderSource, // Support both ProviderInstance and raw provider
    plugins: AiPlugin[] = [],
    middlewares: LanguageModelV4Middleware[] = [],
  ) {
    this.engine = new PluginEngine(plugins);
    this.middlewares = middlewares;

    // Try to extract providerId
    if (this.isProviderLike(provider) && typeof provider.providerId === 'string') {
      this.providerId = provider.providerId;
    } else if (this.isProviderLike(provider) && typeof provider.name === 'string') {
      this.providerId = provider.name;
    } else if (this.isLanguageModel(provider) && typeof provider.provider === 'string') {
      this.providerId = provider.provider;
    } else {
      this.providerId = 'unknown';
    }
  }

  private resolveModel(modelId: string): LanguageModelV4 {
    if (!this.provider) {
      throw new ModelResolutionError(modelId, this.providerId, 'Provider not initialized');
    }

    // If provider has languageModel method, use it
    if (this.hasLanguageModel(this.provider)) {
      return this.provider.languageModel(modelId);
    }

    if (this.hasChatModel(this.provider)) {
      return this.provider.chat(modelId);
    }

    if (this.isLanguageModel(this.provider)) {
      return this.provider;
    }

    throw new ModelResolutionError(
      modelId,
      this.providerId,
      'Provider does not support language models',
    );
  }

  private createContext(modelId: string, method: string): PluginContext {
    return {
      providerId: this.providerId,
      modelId,
      method,
      attempt: 0,
      metadata: {},
    };
  }

  async streamText(
    params: StreamTextParams,
    options?: {
      plugins?: AiPlugin[];
      middlewares?: LanguageModelV4Middleware[];
    },
  ): Promise<StreamTextResponse> {
    const context = this.createContext(params.model, 'streamText');

    // Reuse existing engine when no additional plugins provided
    const engine = options?.plugins?.length
      ? new PluginEngine([...this.engine.getPlugins(), ...options.plugins])
      : this.engine;

    // Merge middlewares
    const allMiddlewares = options?.middlewares?.length
      ? [...this.middlewares, ...options.middlewares]
      : this.middlewares;

    return engine.executeLifecycle(
      'streamText',
      params,
      async (transformedParams) => {
        const { model: modelId, ...restParams } = transformedParams;

        // Resolve model after transformation
        const resolvedModel = this.resolveModel(modelId);
        const wrappedModel =
          allMiddlewares.length > 0
            ? wrapWithMiddlewares(resolvedModel, allMiddlewares)
            : resolvedModel;

        // Update context with transformed modelId
        context.modelId = modelId;

        return aiStreamText({
          model: wrappedModel,
          ...restParams,
        });
      },
      context,
    );
  }

  async generateText(
    params: GenerateTextParams,
    options?: {
      plugins?: AiPlugin[];
      middlewares?: LanguageModelV4Middleware[];
    },
  ): Promise<GenerateTextResponse> {
    const context = this.createContext(params.model, 'generateText');

    const engine = options?.plugins?.length
      ? new PluginEngine([...this.engine.getPlugins(), ...options.plugins])
      : this.engine;

    const allMiddlewares = options?.middlewares?.length
      ? [...this.middlewares, ...options.middlewares]
      : this.middlewares;

    return engine.executeLifecycle(
      'generateText',
      params,
      async (transformedParams) => {
        const { model: modelId, ...restParams } = transformedParams;

        // Resolve model after transformation
        const resolvedModel = this.resolveModel(modelId);
        const wrappedModel =
          allMiddlewares.length > 0
            ? wrapWithMiddlewares(resolvedModel, allMiddlewares)
            : resolvedModel;

        // Update context with transformed modelId
        context.modelId = modelId;

        return aiGenerateText({
          model: wrappedModel,
          ...restParams,
        });
      },
      context,
    );
  }

  async generateObject<T = unknown>(
    params: GenerateObjectParams<T>,
    options?: {
      plugins?: AiPlugin[];
      middlewares?: LanguageModelV4Middleware[];
    },
  ): Promise<GenerateObjectResponse> {
    const context = this.createContext(params.model, 'generateObject');

    const engine = options?.plugins?.length
      ? new PluginEngine([...this.engine.getPlugins(), ...options.plugins])
      : this.engine;

    const allMiddlewares = options?.middlewares?.length
      ? [...this.middlewares, ...options.middlewares]
      : this.middlewares;

    return engine.executeLifecycle(
      'generateObject',
      params,
      async (transformedParams) => {
        const {
          model: modelId,
          stopSequences: _stopSequences,
          schema,
          mode: _mode,
          ...restParams
        } = transformedParams;

        // Resolve model after transformation
        const resolvedModel = this.resolveModel(modelId);
        const wrappedModel =
          allMiddlewares.length > 0
            ? wrapWithMiddlewares(resolvedModel, allMiddlewares)
            : resolvedModel;

        // Update context with transformed modelId
        context.modelId = modelId;

        return aiGenerateText({
          model: wrappedModel,
          output: Output.object({
            schema: schema as Parameters<typeof Output.object>[0]['schema'],
          }),
          ...restParams,
        });
      },
      context,
    );
  }

  async streamObject<T = unknown>(
    params: StreamObjectParams<T>,
    options?: {
      plugins?: AiPlugin[];
      middlewares?: LanguageModelV4Middleware[];
    },
  ): Promise<StreamObjectResponse> {
    const context = this.createContext(params.model, 'streamObject');

    const engine = options?.plugins?.length
      ? new PluginEngine([...this.engine.getPlugins(), ...options.plugins])
      : this.engine;

    const allMiddlewares = options?.middlewares?.length
      ? [...this.middlewares, ...options.middlewares]
      : this.middlewares;

    return engine.executeLifecycle(
      'streamObject',
      params,
      async (transformedParams) => {
        const {
          model: modelId,
          stopSequences: _stopSequences,
          schema,
          mode: _mode,
          ...restParams
        } = transformedParams;

        // Resolve model after transformation
        const resolvedModel = this.resolveModel(modelId);
        const wrappedModel =
          allMiddlewares.length > 0
            ? wrapWithMiddlewares(resolvedModel, allMiddlewares)
            : resolvedModel;

        // Update context with transformed modelId
        context.modelId = modelId;

        return aiStreamText({
          model: wrappedModel,
          output: Output.object({
            schema: schema as Parameters<typeof Output.object>[0]['schema'],
          }),
          ...restParams,
        });
      },
      context,
    );
  }

  // Plugin management
  addPlugin(plugin: AiPlugin): void {
    this.engine.addPlugin(plugin);
  }

  removePlugin(name: string): void {
    this.engine.removePlugin(name);
  }

  getPlugins(): AiPlugin[] {
    return this.engine.getPlugins();
  }

  // Get provider info
  getProviderId(): string {
    return this.providerId;
  }

  private isProviderLike(provider: ProviderSource): provider is ProviderInstance | ProviderLike {
    return typeof provider === 'object' && provider !== null;
  }

  private hasLanguageModel(
    provider: ProviderSource,
  ): provider is
    | ProviderInstance
    | (ProviderLike & { languageModel: ProviderInstance['languageModel'] }) {
    return (
      this.isProviderLike(provider) &&
      typeof (provider as ProviderLike).languageModel === 'function'
    );
  }

  private hasChatModel(
    provider: ProviderSource,
  ): provider is ProviderLike & { chat: ProviderInstance['languageModel'] } {
    return this.isProviderLike(provider) && typeof (provider as ProviderLike).chat === 'function';
  }

  private isLanguageModel(provider: ProviderSource): provider is LanguageModelV4 {
    return (
      typeof provider === 'object' &&
      provider !== null &&
      typeof (provider as LanguageModelV4).doGenerate === 'function'
    );
  }
}
