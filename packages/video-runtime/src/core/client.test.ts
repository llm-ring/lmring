import { describe, expect, it, vi } from 'vitest';
import type { VideoProvider, VideoStreamEvent } from '../types';
import { createVideoClient, createVideoClientFromProvider } from './client';

describe('createVideoClient', () => {
  it('creates a client for a supported provider', () => {
    const client = createVideoClient({
      provider: 'openai',
      apiKey: 'test-key',
      baseURL: 'https://api.openai.com/v1',
      timeout: 1000,
      pollInterval: 100,
      headers: { 'X-Test': '1' },
    });

    expect(client.providerId).toBe('openai');
    expect(client.capabilities.textToVideo).toBe(true);
  });
});

describe('createVideoClientFromProvider', () => {
  it('wraps provider generate and exposes capabilities', async () => {
    const events: VideoStreamEvent[] = [
      { type: 'progress', progress: 50 },
      { type: 'video', video: { url: 'https://v.example/a.mp4', mimeType: 'video/mp4' } },
    ];

    const provider: VideoProvider = {
      providerId: 'minimax',
      displayName: 'MiniMax',
      defaultBaseURL: 'https://api.minimax.example',
      capabilities: {
        textToVideo: true,
        imageToVideo: true,
        startEndFrames: false,
        cameraMovement: false,
        maxDurationSeconds: 6,
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

    const client = createVideoClientFromProvider(provider);
    expect(client.providerId).toBe('minimax');
    expect(client.capabilities).toEqual(provider.capabilities);

    const collected: VideoStreamEvent[] = [];
    for await (const event of client.generate({
      model: 'hailuo',
      input: { type: 'text-to-video', prompt: 'hi' },
    })) {
      collected.push(event);
    }

    expect(collected).toEqual(events);
    expect(provider.generate).toHaveBeenCalled();
  });
});
