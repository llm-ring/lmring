import { describe, expect, it, vi } from 'vitest';
import type { VideoGenerationParams, VideoProvider, VideoStreamEvent } from '../types';
import { createVideoRouter, detectProviderFromModel, VideoRouter } from './router';

function mockProvider(
  providerId: VideoProvider['providerId'],
  events: VideoStreamEvent[] = [{ type: 'heartbeat', timestamp: 1 }],
): VideoProvider {
  return {
    providerId,
    displayName: providerId,
    defaultBaseURL: 'https://example.com',
    capabilities: {
      textToVideo: true,
      imageToVideo: false,
      startEndFrames: false,
      cameraMovement: false,
      maxDurationSeconds: 10,
      aspectRatios: ['16:9'],
      qualityTiers: ['standard'],
      audio: false,
    },
    resolveModelId: (id) => id,
    validateParams: () => ({ valid: true }),
    generate: vi.fn(async function* () {
      for (const event of events) {
        yield event;
      }
    }),
  };
}

describe('detectProviderFromModel', () => {
  it.each([
    ['openai/sora-2', 'openai'],
    ['sora-2', 'openai'],
    ['google/veo-3', 'google'],
    ['veo-2', 'google'],
    ['minimax/hailuo-2.3', 'minimax'],
    ['hailuo-2', 'minimax'],
    ['kling-v1', 'kling'],
    ['kuaishou/kling', 'kling'],
    ['seedance-1', 'seedance'],
    ['bytedance/seedance', 'seedance'],
    ['doubao-video', 'seedance'],
    ['vidu-q1', 'vidu'],
    ['dashscope/wanx', 'dashscope'],
    ['wanx-v1', 'dashscope'],
    ['wan-2.1', 'dashscope'],
  ] as const)('detects %s as %s', (model, provider) => {
    expect(detectProviderFromModel(model)).toBe(provider);
  });

  it('returns undefined for unknown models', () => {
    expect(detectProviderFromModel('totally-unknown-model')).toBeUndefined();
  });
});

describe('VideoRouter', () => {
  const params: VideoGenerationParams = {
    model: 'openai/sora-2',
    input: { type: 'text-to-video', prompt: 'hello' },
  };

  it('createVideoRouter initializes configured providers', () => {
    const router = createVideoRouter({
      providers: {
        openai: { apiKey: 'k1' },
        minimax: { apiKey: 'k2' },
      },
      defaultProvider: 'openai',
    });

    expect(router.hasProvider('openai')).toBe(true);
    expect(router.hasProvider('minimax')).toBe(true);
    expect(router.getConfiguredProviders()).toEqual(expect.arrayContaining(['openai', 'minimax']));
  });

  it('getProviderForModel uses explicit, detected, then default', () => {
    const router = new VideoRouter({
      providers: {
        openai: { apiKey: 'k1' },
        minimax: { apiKey: 'k2' },
      },
      defaultProvider: 'minimax',
    });

    expect(router.getProviderForModel('x', 'openai')?.providerId).toBe('openai');
    expect(router.getProviderForModel('openai/sora-2')?.providerId).toBe('openai');
    expect(router.getProviderForModel('unknown-model')?.providerId).toBe('minimax');
  });

  it('returns undefined when no provider matches', () => {
    const router = new VideoRouter({
      providers: {
        openai: { apiKey: 'k1' },
      },
    });
    expect(router.getProviderForModel('unknown-model')).toBeUndefined();
  });

  it('generate yields provider-not-found error when no provider', async () => {
    const router = new VideoRouter({ providers: {} });
    const events: VideoStreamEvent[] = [];
    for await (const event of router.generate(params)) {
      events.push(event);
    }
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'error',
      error: { code: 'PROVIDER_NOT_FOUND' },
    });
  });

  it('generate delegates to resolved provider', async () => {
    const provider = mockProvider('openai', [
      { type: 'video', video: { url: 'https://v.example/1.mp4', mimeType: 'video/mp4' } },
    ]);

    const router = new VideoRouter({
      providers: { openai: { apiKey: 'k' } },
    });
    // Replace cached instance with mock
    (router as unknown as { providers: Map<string, VideoProvider> }).providers.set(
      'openai',
      provider,
    );

    const events: VideoStreamEvent[] = [];
    for await (const event of router.generate(params)) {
      events.push(event);
    }

    expect(provider.generate).toHaveBeenCalled();
    expect(events[0]).toMatchObject({ type: 'video' });
  });

  it('addProvider and removeProvider update registry', () => {
    const router = new VideoRouter({ providers: {} });
    router.addProvider('vidu', { apiKey: 'k' });
    expect(router.hasProvider('vidu')).toBe(true);
    expect(router.removeProvider('vidu')).toBe(true);
    expect(router.hasProvider('vidu')).toBe(false);
    expect(router.removeProvider('vidu')).toBe(false);
  });
});
