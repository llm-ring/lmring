import type { LanguageModelV4, LanguageModelV4Middleware } from '@ai-sdk/provider';
import * as aiSdk from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiPlugin, type PluginContext } from '../../types/plugin';
import { ModelResolutionError } from '../../utils/errors';
import { RuntimeExecutor } from './executor';

vi.mock('ai', () => ({
  streamText: vi.fn(),
  generateText: vi.fn(),
  wrapLanguageModel: vi.fn(({ model }) => model),
  Output: {
    object: vi.fn().mockReturnValue({ type: 'object', schema: {} }),
  },
}));

const createMockLanguageModel = (
  provider = 'test-provider',
  modelId = 'test-model',
): LanguageModelV4 => ({
  specificationVersion: 'v4',
  provider,
  modelId,
  supportedUrls: {},
  doGenerate: vi.fn().mockResolvedValue({ text: 'generated' }),
  doStream: vi.fn().mockResolvedValue({ stream: new ReadableStream() }),
});

const createMockProviderInstance = () => ({
  providerId: 'mock-provider',
  languageModel: vi.fn((modelId: string) => createMockLanguageModel('mock-provider', modelId)),
});

const createMockProviderWithChat = () => ({
  name: 'chat-provider',
  chat: vi.fn((modelId: string) => createMockLanguageModel('chat-provider', modelId)),
});

class TestPlugin extends AiPlugin {
  name = 'TestPlugin';
  transformParamsCalled = false;
  transformResultCalled = false;

  async transformParams(params: unknown, _context: PluginContext): Promise<unknown> {
    this.transformParamsCalled = true;
    return params;
  }

  async transformResult(result: unknown, _context: PluginContext): Promise<unknown> {
    this.transformResultCalled = true;
    return result;
  }
}

describe('RuntimeExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('extracts providerId from ProviderInstance', () => {
      const provider = createMockProviderInstance();
      const executor = new RuntimeExecutor(provider);
      expect(executor.getProviderId()).toBe('mock-provider');
    });

    it('extracts providerId from provider name', () => {
      const provider = createMockProviderWithChat();
      const executor = new RuntimeExecutor(provider);
      expect(executor.getProviderId()).toBe('chat-provider');
    });

    it('extracts providerId from LanguageModelV4', () => {
      const model = createMockLanguageModel('lm-provider');
      const executor = new RuntimeExecutor(model);
      expect(executor.getProviderId()).toBe('lm-provider');
    });

    it('uses "unknown" when providerId cannot be determined', () => {
      const executor = new RuntimeExecutor({});
      expect(executor.getProviderId()).toBe('unknown');
    });

    it('accepts plugins array', () => {
      const plugin = new TestPlugin();
      const executor = new RuntimeExecutor(createMockProviderInstance(), [plugin]);
      expect(executor.getPlugins()).toHaveLength(1);
      expect(executor.getPlugins()[0]?.name).toBe('TestPlugin');
    });

    it('accepts middlewares array', () => {
      const middleware: LanguageModelV4Middleware = { specificationVersion: 'v4' };
      const executor = new RuntimeExecutor(createMockProviderInstance(), [], [middleware]);
      expect(executor.getProviderId()).toBe('mock-provider');
    });
  });

  describe('resolveModel', () => {
    it('resolves model via languageModel method', async () => {
      const provider = createMockProviderInstance();
      const executor = new RuntimeExecutor(provider);
      vi.mocked(aiSdk.streamText).mockResolvedValue({ text: 'result' } as never);

      await executor.streamText({ model: 'gpt-4', messages: [] });

      expect(provider.languageModel).toHaveBeenCalledWith('gpt-4');
    });

    it('resolves model via chat method as fallback', async () => {
      const provider = createMockProviderWithChat();
      const executor = new RuntimeExecutor(provider);
      vi.mocked(aiSdk.streamText).mockResolvedValue({ text: 'result' } as never);

      await executor.streamText({ model: 'model', messages: [] });

      expect(provider.chat).toHaveBeenCalledWith('model');
    });

    it('uses LanguageModelV4 directly if provider is a model', async () => {
      const model = createMockLanguageModel();
      const executor = new RuntimeExecutor(model);
      vi.mocked(aiSdk.streamText).mockResolvedValue({ text: 'result' } as never);

      await executor.streamText({ model: 'ignored', messages: [] });

      expect(aiSdk.streamText).toHaveBeenCalledWith(expect.objectContaining({ model }));
    });

    it('throws ModelResolutionError when provider is null', async () => {
      const executor = new RuntimeExecutor(null as never);

      await expect(executor.streamText({ model: 'model', messages: [] })).rejects.toThrow(
        ModelResolutionError,
      );
    });

    it('throws ModelResolutionError when provider has no model methods', async () => {
      const executor = new RuntimeExecutor({ name: 'invalid' });

      await expect(executor.streamText({ model: 'model', messages: [] })).rejects.toThrow(
        'Provider does not support language models',
      );
    });
  });

  describe('streamText', () => {
    it('calls ai SDK streamText with resolved model', async () => {
      const provider = createMockProviderInstance();
      const executor = new RuntimeExecutor(provider);
      const mockResult = { text: 'streamed' };
      vi.mocked(aiSdk.streamText).mockResolvedValue(mockResult as never);

      const result = await executor.streamText({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'hello' }],
      });

      expect(aiSdk.streamText).toHaveBeenCalled();
      expect(result).toBe(mockResult);
    });

    it('passes temperature and maxTokens', async () => {
      const provider = createMockProviderInstance();
      const executor = new RuntimeExecutor(provider);
      vi.mocked(aiSdk.streamText).mockResolvedValue({} as never);

      await executor.streamText({
        model: 'gpt-4',
        messages: [],
        temperature: 0.7,
        maxTokens: 100,
      });

      expect(aiSdk.streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
          maxTokens: 100,
        }),
      );
    });

    it('merges per-call plugins with constructor plugins', async () => {
      const constructorPlugin = new TestPlugin();
      constructorPlugin.name = 'Constructor';
      const callPlugin = new TestPlugin();
      callPlugin.name = 'Call';

      const provider = createMockProviderInstance();
      const executor = new RuntimeExecutor(provider, [constructorPlugin]);
      vi.mocked(aiSdk.streamText).mockResolvedValue({} as never);

      await executor.streamText({ model: 'm', messages: [] }, { plugins: [callPlugin] });

      expect(constructorPlugin.transformParamsCalled).toBe(true);
      expect(callPlugin.transformParamsCalled).toBe(true);
    });
  });

  describe('generateText', () => {
    it('calls ai SDK generateText', async () => {
      const provider = createMockProviderInstance();
      const executor = new RuntimeExecutor(provider);
      const mockResult = { text: 'generated' };
      vi.mocked(aiSdk.generateText).mockResolvedValue(mockResult as never);

      const result = await executor.generateText({
        model: 'gpt-4',
        messages: [],
      });

      expect(aiSdk.generateText).toHaveBeenCalled();
      expect(result).toBe(mockResult);
    });

    it('passes system prompt', async () => {
      const provider = createMockProviderInstance();
      const executor = new RuntimeExecutor(provider);
      vi.mocked(aiSdk.generateText).mockResolvedValue({} as never);

      await executor.generateText({
        model: 'gpt-4',
        messages: [],
        system: 'You are a helpful assistant',
      });

      expect(aiSdk.generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are a helpful assistant',
        }),
      );
    });
  });

  describe('generateObject', () => {
    it('calls generateText with Output.object', async () => {
      const provider = createMockProviderInstance();
      const executor = new RuntimeExecutor(provider);
      vi.mocked(aiSdk.generateText).mockResolvedValue({} as never);

      const schema = { type: 'object', properties: { name: { type: 'string' } } };
      await executor.generateObject({
        model: 'gpt-4',
        messages: [],
        schema,
      });

      expect(aiSdk.Output.object).toHaveBeenCalledWith({ schema });
      expect(aiSdk.generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          output: expect.anything(),
        }),
      );
    });
  });

  describe('streamObject', () => {
    it('calls streamText with Output.object', async () => {
      const provider = createMockProviderInstance();
      const executor = new RuntimeExecutor(provider);
      vi.mocked(aiSdk.streamText).mockResolvedValue({} as never);

      const schema = { type: 'object', properties: {} };
      await executor.streamObject({
        model: 'gpt-4',
        messages: [],
        schema,
      });

      expect(aiSdk.Output.object).toHaveBeenCalledWith({ schema });
      expect(aiSdk.streamText).toHaveBeenCalled();
    });
  });

  describe('plugin management', () => {
    it('addPlugin adds a plugin', () => {
      const executor = new RuntimeExecutor(createMockProviderInstance());
      const plugin = new TestPlugin();

      executor.addPlugin(plugin);

      expect(executor.getPlugins()).toContain(plugin);
    });

    it('removePlugin removes a plugin by name', () => {
      const plugin = new TestPlugin();
      const executor = new RuntimeExecutor(createMockProviderInstance(), [plugin]);

      executor.removePlugin('TestPlugin');

      expect(executor.getPlugins()).not.toContain(plugin);
    });

    it('getPlugins returns all plugins', () => {
      const plugin1 = new TestPlugin();
      plugin1.name = 'Plugin1';
      const plugin2 = new TestPlugin();
      plugin2.name = 'Plugin2';
      const executor = new RuntimeExecutor(createMockProviderInstance(), [plugin1, plugin2]);

      expect(executor.getPlugins()).toHaveLength(2);
    });
  });

  describe('middleware wrapping', () => {
    it('wraps model with middlewares when provided', async () => {
      const middleware: LanguageModelV4Middleware = {
        specificationVersion: 'v4',
        transformParams: async ({ params }) => params,
      };
      const provider = createMockProviderInstance();
      const executor = new RuntimeExecutor(provider, [], [middleware]);
      vi.mocked(aiSdk.streamText).mockResolvedValue({} as never);

      await executor.streamText({ model: 'gpt-4', messages: [] });

      expect(aiSdk.streamText).toHaveBeenCalled();
    });

    it('merges per-call middlewares with constructor middlewares', async () => {
      const constructorMw: LanguageModelV4Middleware = { specificationVersion: 'v4' };
      const callMw: LanguageModelV4Middleware = { specificationVersion: 'v4' };

      const provider = createMockProviderInstance();
      const executor = new RuntimeExecutor(provider, [], [constructorMw]);
      vi.mocked(aiSdk.streamText).mockResolvedValue({} as never);

      await executor.streamText({ model: 'm', messages: [] }, { middlewares: [callMw] });

      expect(aiSdk.streamText).toHaveBeenCalled();
    });
  });

  describe('optimization: engine and middleware reuse', () => {
    it('reuses existing engine when no per-call plugins provided', async () => {
      const constructorPlugin = new TestPlugin();
      constructorPlugin.name = 'Constructor';

      const provider = createMockProviderInstance();
      const executor = new RuntimeExecutor(provider, [constructorPlugin]);
      vi.mocked(aiSdk.streamText).mockResolvedValue({} as never);

      await executor.streamText({ model: 'm', messages: [] });

      expect(constructorPlugin.transformParamsCalled).toBe(true);
    });

    it('reuses existing engine when options.plugins is empty array', async () => {
      const constructorPlugin = new TestPlugin();
      constructorPlugin.name = 'Constructor';

      const provider = createMockProviderInstance();
      const executor = new RuntimeExecutor(provider, [constructorPlugin]);
      vi.mocked(aiSdk.streamText).mockResolvedValue({} as never);

      await executor.streamText({ model: 'm', messages: [] }, { plugins: [] });

      expect(constructorPlugin.transformParamsCalled).toBe(true);
    });

    it('reuses existing middlewares when no per-call middlewares provided', async () => {
      const constructorMw: LanguageModelV4Middleware = {
        specificationVersion: 'v4',
        transformParams: async ({ params }) => params,
      };

      const provider = createMockProviderInstance();
      const executor = new RuntimeExecutor(provider, [], [constructorMw]);
      vi.mocked(aiSdk.streamText).mockResolvedValue({} as never);

      await executor.streamText({ model: 'm', messages: [] });

      expect(aiSdk.streamText).toHaveBeenCalled();
    });

    it('reuses existing middlewares when options.middlewares is empty array', async () => {
      const constructorMw: LanguageModelV4Middleware = {
        specificationVersion: 'v4',
        transformParams: async ({ params }) => params,
      };

      const provider = createMockProviderInstance();
      const executor = new RuntimeExecutor(provider, [], [constructorMw]);
      vi.mocked(aiSdk.streamText).mockResolvedValue({} as never);

      await executor.streamText({ model: 'm', messages: [] }, { middlewares: [] });

      expect(aiSdk.streamText).toHaveBeenCalled();
    });

    it('creates new engine only when per-call plugins are provided', async () => {
      const constructorPlugin = new TestPlugin();
      constructorPlugin.name = 'Constructor';
      const callPlugin = new TestPlugin();
      callPlugin.name = 'Call';

      const provider = createMockProviderInstance();
      const executor = new RuntimeExecutor(provider, [constructorPlugin]);
      vi.mocked(aiSdk.streamText).mockResolvedValue({} as never);

      await executor.streamText({ model: 'm', messages: [] }, { plugins: [callPlugin] });

      expect(constructorPlugin.transformParamsCalled).toBe(true);
      expect(callPlugin.transformParamsCalled).toBe(true);
    });

    it('applies optimization across all execution methods', async () => {
      const constructorPlugin = new TestPlugin();
      constructorPlugin.name = 'Constructor';

      const provider = createMockProviderInstance();
      const executor = new RuntimeExecutor(provider, [constructorPlugin]);
      vi.mocked(aiSdk.generateText).mockResolvedValue({} as never);
      vi.mocked(aiSdk.streamText).mockResolvedValue({} as never);

      await executor.generateText({ model: 'm', messages: [] }, { plugins: [] });
      expect(constructorPlugin.transformParamsCalled).toBe(true);

      constructorPlugin.transformParamsCalled = false;

      await executor.generateObject({ model: 'm', messages: [], schema: {} }, { plugins: [] });
      expect(constructorPlugin.transformParamsCalled).toBe(true);

      constructorPlugin.transformParamsCalled = false;

      await executor.streamObject({ model: 'm', messages: [], schema: {} }, { plugins: [] });
      expect(constructorPlugin.transformParamsCalled).toBe(true);
    });
  });
});
