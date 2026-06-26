import type { LanguageModelV4, LanguageModelV4Middleware } from '@ai-sdk/provider';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderBuilder } from '../../providers/builder';
import { registry } from '../../providers/registry';
import { ModelResolutionError, ProviderError } from '../../utils/errors';
import { ModelResolver, modelResolver } from './resolver';

vi.mock('ai', () => ({
  wrapLanguageModel: vi.fn(({ model }) => model),
}));

const createMockLanguageModel = (): LanguageModelV4 => ({
  specificationVersion: 'v4',
  provider: 'mock',
  modelId: 'mock-model',
  supportedUrls: {},
  doGenerate: vi.fn(),
  doStream: vi.fn(),
});

const createMockProviderInstance = () => ({
  providerId: 'mock-provider',
  name: 'Mock Provider',
  languageModel: vi.fn(() => createMockLanguageModel()),
});

describe('ModelResolver', () => {
  let resolver: ModelResolver;

  beforeEach(() => {
    resolver = new ModelResolver();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resolver.clearCache();
  });

  describe('parseModelId', () => {
    it('parses model ID with > separator', () => {
      vi.spyOn(registry, 'get').mockReturnValue({
        id: 'openai',
        name: 'OpenAI',
        type: 'official',
        creator: () => createMockProviderInstance(),
      });
      vi.spyOn(ProviderBuilder, 'createProviderInstance').mockReturnValue(
        createMockProviderInstance(),
      );

      const result = resolver.resolve('openai>gpt-4');

      expect(result.providerId).toBe('openai');
      expect(result.modelId).toBe('gpt-4');
    });

    it('parses model ID with | separator (Cherry Studio)', () => {
      vi.spyOn(registry, 'get').mockReturnValue({
        id: 'anthropic',
        name: 'Anthropic',
        type: 'official',
        creator: () => createMockProviderInstance(),
      });
      vi.spyOn(ProviderBuilder, 'createProviderInstance').mockReturnValue(
        createMockProviderInstance(),
      );

      const result = resolver.resolve('anthropic|claude-3');

      expect(result.providerId).toBe('anthropic');
      expect(result.modelId).toBe('claude-3');
    });

    it('parses model ID with : separator', () => {
      vi.spyOn(registry, 'get').mockReturnValue({
        id: 'openai',
        name: 'OpenAI',
        type: 'official',
        creator: () => createMockProviderInstance(),
      });
      vi.spyOn(ProviderBuilder, 'createProviderInstance').mockReturnValue(
        createMockProviderInstance(),
      );

      const result = resolver.resolve('openai:gpt-4');

      expect(result.providerId).toBe('openai');
      expect(result.modelId).toBe('gpt-4');
    });

    it('uses fallback provider when no separator found', () => {
      vi.spyOn(registry, 'get').mockReturnValue({
        id: 'openai',
        name: 'OpenAI',
        type: 'official',
        creator: () => createMockProviderInstance(),
      });
      vi.spyOn(ProviderBuilder, 'createProviderInstance').mockReturnValue(
        createMockProviderInstance(),
      );

      const result = resolver.resolve('gpt-4', 'openai');

      expect(result.providerId).toBe('openai');
      expect(result.modelId).toBe('gpt-4');
    });

    it('throws when no provider can be determined', () => {
      expect(() => resolver.resolve('gpt-4')).toThrow(ModelResolutionError);
      expect(() => resolver.resolve('gpt-4')).toThrow('Unable to determine provider ID');
    });

    it('trims whitespace from provider and model parts', () => {
      vi.spyOn(registry, 'get').mockReturnValue({
        id: 'openai',
        name: 'OpenAI',
        type: 'official',
        creator: () => createMockProviderInstance(),
      });
      vi.spyOn(ProviderBuilder, 'createProviderInstance').mockReturnValue(
        createMockProviderInstance(),
      );

      const result = resolver.resolve('  openai  >  gpt-4  ');

      expect(result.providerId).toBe('openai');
      expect(result.modelId).toBe('gpt-4');
    });
  });

  describe('provider resolution', () => {
    it('throws ProviderError when provider not found', () => {
      vi.spyOn(registry, 'get').mockReturnValue(undefined);

      expect(() => resolver.resolve('unknown>model')).toThrow(ProviderError);
      expect(() => resolver.resolve('unknown>model')).toThrow('not found in registry');
    });

    it('creates provider instance via ProviderBuilder', () => {
      const mockInstance = createMockProviderInstance();
      vi.spyOn(registry, 'get').mockReturnValue({
        id: 'openai',
        name: 'OpenAI',
        type: 'official',
        creator: () => mockInstance,
      });
      const createSpy = vi
        .spyOn(ProviderBuilder, 'createProviderInstance')
        .mockReturnValue(mockInstance);

      resolver.resolve('openai>gpt-4');

      expect(createSpy).toHaveBeenCalledWith('openai', expect.any(Object));
    });

    it('passes providerOptions to builder', () => {
      const mockInstance = createMockProviderInstance();
      vi.spyOn(registry, 'get').mockReturnValue({
        id: 'openai',
        name: 'OpenAI',
        type: 'official',
        creator: () => mockInstance,
      });
      const createSpy = vi
        .spyOn(ProviderBuilder, 'createProviderInstance')
        .mockReturnValue(mockInstance);

      resolver.resolve('openai>gpt-4', undefined, {
        providerOptions: { apiKey: 'test-key' },
      });

      expect(createSpy).toHaveBeenCalledWith(
        'openai',
        expect.objectContaining({ apiKey: 'test-key' }),
      );
    });
  });

  describe('format detection', () => {
    it('detects anthropic format for claude models', () => {
      vi.spyOn(registry, 'get').mockReturnValue({
        id: 'openrouter',
        name: 'OpenRouter',
        type: 'compatible',
        compatibleConfig: { baseURL: 'https://api.openrouter.ai/api/v1' },
      });
      vi.spyOn(ProviderBuilder, 'createProviderInstance').mockReturnValue(
        createMockProviderInstance(),
      );

      const result = resolver.resolve('openrouter>claude-3-opus');

      expect(result.format).toBe('anthropic');
    });

    it('detects openai format for non-claude models', () => {
      vi.spyOn(registry, 'get').mockReturnValue({
        id: 'openai',
        name: 'OpenAI',
        type: 'official',
        creator: () => createMockProviderInstance(),
      });
      vi.spyOn(ProviderBuilder, 'createProviderInstance').mockReturnValue(
        createMockProviderInstance(),
      );

      const result = resolver.resolve('openai>gpt-4');

      expect(result.format).toBe('openai');
    });

    it('respects explicit useAnthropicFormat option', () => {
      vi.spyOn(registry, 'get').mockReturnValue({
        id: 'openai',
        name: 'OpenAI',
        type: 'official',
        creator: () => createMockProviderInstance(),
      });
      vi.spyOn(ProviderBuilder, 'createProviderInstance').mockReturnValue(
        createMockProviderInstance(),
      );

      const result = resolver.resolve('openai>gpt-4', undefined, {
        useAnthropicFormat: true,
      });

      expect(result.format).toBe('anthropic');
    });

    it('explicit useAnthropicFormat=false overrides claude detection', () => {
      vi.spyOn(registry, 'get').mockReturnValue({
        id: 'openrouter',
        name: 'OpenRouter',
        type: 'compatible',
        compatibleConfig: { baseURL: 'https://api.openrouter.ai/api/v1' },
      });
      vi.spyOn(ProviderBuilder, 'createProviderInstance').mockReturnValue(
        createMockProviderInstance(),
      );

      const result = resolver.resolve('openrouter>claude-3-opus', undefined, {
        useAnthropicFormat: false,
      });

      expect(result.format).toBe('openai');
    });
  });

  describe('caching', () => {
    it('caches resolved models', () => {
      const mockInstance = createMockProviderInstance();
      vi.spyOn(registry, 'get').mockReturnValue({
        id: 'openai',
        name: 'OpenAI',
        type: 'official',
        creator: () => mockInstance,
      });
      const createSpy = vi
        .spyOn(ProviderBuilder, 'createProviderInstance')
        .mockReturnValue(mockInstance);

      resolver.resolve('openai>gpt-4');
      resolver.resolve('openai>gpt-4');

      expect(createSpy).toHaveBeenCalledTimes(1);
    });

    it('uses different cache keys for different options', () => {
      const mockInstance = createMockProviderInstance();
      vi.spyOn(registry, 'get').mockReturnValue({
        id: 'openai',
        name: 'OpenAI',
        type: 'official',
        creator: () => mockInstance,
      });
      const createSpy = vi
        .spyOn(ProviderBuilder, 'createProviderInstance')
        .mockReturnValue(mockInstance);

      resolver.resolve('openai>gpt-4', undefined, { useAnthropicFormat: false });
      resolver.resolve('openai>gpt-4', undefined, { useAnthropicFormat: true });

      expect(createSpy).toHaveBeenCalledTimes(2);
    });

    it('skips cache when middlewares are provided', () => {
      const mockInstance = createMockProviderInstance();
      vi.spyOn(registry, 'get').mockReturnValue({
        id: 'openai',
        name: 'OpenAI',
        type: 'official',
        creator: () => mockInstance,
      });
      const createSpy = vi
        .spyOn(ProviderBuilder, 'createProviderInstance')
        .mockReturnValue(mockInstance);

      const middleware: LanguageModelV4Middleware = { specificationVersion: 'v4' };
      resolver.resolve('openai>gpt-4', undefined, { middlewares: [middleware] });
      resolver.resolve('openai>gpt-4', undefined, { middlewares: [middleware] });

      expect(createSpy).toHaveBeenCalledTimes(2);
    });

    it('clearCache clears all cached entries', () => {
      const mockInstance = createMockProviderInstance();
      vi.spyOn(registry, 'get').mockReturnValue({
        id: 'openai',
        name: 'OpenAI',
        type: 'official',
        creator: () => mockInstance,
      });
      const createSpy = vi
        .spyOn(ProviderBuilder, 'createProviderInstance')
        .mockReturnValue(mockInstance);

      resolver.resolve('openai>gpt-4');
      expect(resolver.getCacheSize()).toBe(1);

      resolver.clearCache();
      expect(resolver.getCacheSize()).toBe(0);

      resolver.resolve('openai>gpt-4');
      expect(createSpy).toHaveBeenCalledTimes(2);
    });

    it('getCacheSize returns correct count', () => {
      const mockInstance = createMockProviderInstance();
      vi.spyOn(registry, 'get').mockReturnValue({
        id: 'openai',
        name: 'OpenAI',
        type: 'official',
        creator: () => mockInstance,
      });
      vi.spyOn(ProviderBuilder, 'createProviderInstance').mockReturnValue(mockInstance);

      expect(resolver.getCacheSize()).toBe(0);
      resolver.resolve('openai>gpt-4');
      expect(resolver.getCacheSize()).toBe(1);
      resolver.resolve('openai>gpt-3.5-turbo');
      expect(resolver.getCacheSize()).toBe(2);
    });
  });

  describe('middleware wrapping', () => {
    it('wraps model with middlewares when provided', () => {
      const mockInstance = createMockProviderInstance();
      vi.spyOn(registry, 'get').mockReturnValue({
        id: 'openai',
        name: 'OpenAI',
        type: 'official',
        creator: () => mockInstance,
      });
      vi.spyOn(ProviderBuilder, 'createProviderInstance').mockReturnValue(mockInstance);

      const middleware: LanguageModelV4Middleware = { specificationVersion: 'v4' };
      const result = resolver.resolve('openai>gpt-4', undefined, {
        middlewares: [middleware],
      });

      expect(result.model).toBeDefined();
    });

    it('does not wrap when no middlewares provided', () => {
      const mockInstance = createMockProviderInstance();
      vi.spyOn(registry, 'get').mockReturnValue({
        id: 'openai',
        name: 'OpenAI',
        type: 'official',
        creator: () => mockInstance,
      });
      vi.spyOn(ProviderBuilder, 'createProviderInstance').mockReturnValue(mockInstance);

      const result = resolver.resolve('openai>gpt-4');

      expect(result.model).toBeDefined();
    });
  });

  describe('model retrieval', () => {
    it('throws when provider has no languageModel or chat method', () => {
      vi.spyOn(registry, 'get').mockReturnValue({
        id: 'bad-provider',
        name: 'Bad',
        type: 'official',
        creator: (() => ({ providerId: 'bad' })) as never,
      });
      vi.spyOn(ProviderBuilder, 'createProviderInstance').mockReturnValue({
        providerId: 'bad',
      } as never);

      expect(() => resolver.resolve('bad-provider>model')).toThrow(ModelResolutionError);
      expect(() => resolver.resolve('bad-provider>model')).toThrow(
        'Provider does not support language models',
      );
    });

    it('uses chat method as fallback', () => {
      const model = createMockLanguageModel();
      const mockInstance = {
        providerId: 'chat-only',
        chat: vi.fn(() => model),
      };
      vi.spyOn(registry, 'get').mockReturnValue({
        id: 'chat-only',
        name: 'ChatOnly',
        type: 'official',
        creator: (() => mockInstance) as never,
      });
      vi.spyOn(ProviderBuilder, 'createProviderInstance').mockReturnValue(mockInstance as never);

      const result = resolver.resolve('chat-only>model');

      expect(mockInstance.chat).toHaveBeenCalledWith('model');
      expect(result.model).toBe(model);
    });
  });
});

describe('modelResolver (global instance)', () => {
  it('is an instance of ModelResolver', () => {
    expect(modelResolver).toBeInstanceOf(ModelResolver);
  });
});
