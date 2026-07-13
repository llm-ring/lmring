import { describe, expect, it } from 'vitest';
import { VideoProviderFactory } from './factory';

describe('VideoProviderFactory', () => {
  const config = { apiKey: 'test-key' };

  it('creates instances for all supported providers', () => {
    const factory = new VideoProviderFactory();
    for (const provider of factory.getSupportedProviders()) {
      const instance = factory.createProvider(provider, {
        ...config,
        baseURL: provider === 'openai-compatible' ? 'https://proxy.example.com/v1' : undefined,
      });
      expect(instance.providerId).toBe(provider);
      expect(factory.isSupported(provider)).toBe(true);
    }
  });

  it('caches providers by baseURL', () => {
    const factory = new VideoProviderFactory();
    const a = factory.createProvider('openai', config);
    const b = factory.createProvider('openai', config);
    const c = factory.createProvider('openai', { ...config, baseURL: 'https://custom.example' });

    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('clearCache forces new instances', () => {
    const factory = new VideoProviderFactory();
    const a = factory.createProvider('minimax', config);
    factory.clearCache();
    const b = factory.createProvider('minimax', config);
    expect(a).not.toBe(b);
  });

  it('throws for unsupported provider', () => {
    const factory = new VideoProviderFactory();
    expect(() => factory.createProvider('unknown' as never, config)).toThrow(
      /Provider 'unknown' not found/,
    );
  });

  it('reports unsupported providers', () => {
    const factory = new VideoProviderFactory();
    expect(factory.isSupported('not-real' as never)).toBe(false);
  });
});
