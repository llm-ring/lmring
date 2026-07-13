import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VideoGenerationParams, VideoProviderCapabilities, VideoTaskState } from '../types';
import { BaseVideoProvider, stripProviderPrefix } from './base';

class TestProvider extends BaseVideoProvider {
  readonly providerId = 'openai' as const;
  readonly displayName = 'Test';
  readonly defaultBaseURL = 'https://api.test.example';
  readonly capabilities: VideoProviderCapabilities = {
    textToVideo: true,
    imageToVideo: false,
    startEndFrames: false,
    cameraMovement: false,
    maxDurationSeconds: 10,
    aspectRatios: ['16:9', '9:16'],
    qualityTiers: ['standard', 'high'],
    audio: false,
  };

  createTaskImpl: (params: VideoGenerationParams, signal?: AbortSignal) => Promise<string> =
    async () => 'task-1';
  pollImpl: (taskId: string, signal?: AbortSignal) => Promise<VideoTaskState> = async () => ({
    taskId: 'task-1',
    status: 'completed',
    result: { url: 'https://v.example/1.mp4', mimeType: 'video/mp4' },
  });

  protected createTask(params: VideoGenerationParams, signal?: AbortSignal): Promise<string> {
    return this.createTaskImpl(params, signal);
  }

  protected pollTaskStatus(taskId: string, signal?: AbortSignal): Promise<VideoTaskState> {
    return this.pollImpl(taskId, signal);
  }

  resolveModelId(modelId: string): string {
    return stripProviderPrefix(modelId);
  }

  // expose protected helpers for assertions
  public authHeaders() {
    return this.getAuthHeaders();
  }

  public get resolvedBaseURL() {
    return this.baseURL;
  }

  public get resolvedPollInterval() {
    return this.pollInterval;
  }

  public get resolvedTimeout() {
    return this.timeout;
  }
}

const baseParams: VideoGenerationParams = {
  model: 'openai/sora-2',
  input: { type: 'text-to-video', prompt: 'hello' },
  duration: 5,
  aspectRatio: '16:9',
  quality: 'standard',
};

async function collect(provider: TestProvider, params = baseParams, signal?: AbortSignal) {
  const events = [];
  for await (const event of provider.generate(params, signal)) {
    events.push(event);
  }
  return events;
}

describe('stripProviderPrefix', () => {
  it('strips provider prefix when present', () => {
    expect(stripProviderPrefix('openai/sora-2')).toBe('sora-2');
    expect(stripProviderPrefix('sora-2')).toBe('sora-2');
  });
});

describe('BaseVideoProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('uses config defaults and auth headers', () => {
    const provider = new TestProvider({
      apiKey: 'secret',
      baseURL: 'https://custom.example',
      pollInterval: 50,
      timeout: 1234,
      headers: { 'X-Extra': '1' },
    });

    expect(provider.resolvedBaseURL).toBe('https://custom.example');
    expect(provider.resolvedPollInterval).toBe(50);
    expect(provider.resolvedTimeout).toBe(1234);
    expect(provider.authHeaders()).toEqual({
      Authorization: 'Bearer secret',
      'X-Extra': '1',
    });
    expect(provider.resolveModelId('openai/sora-2')).toBe('sora-2');
  });

  it('falls back to provider defaults when config is sparse', () => {
    const provider = new TestProvider({ apiKey: 'k' });
    expect(provider.resolvedBaseURL).toBe('https://api.test.example');
    expect(provider.resolvedPollInterval).toBe(2000);
    expect(provider.resolvedTimeout).toBe(300_000);
  });

  it('validateParams reports capability mismatches', () => {
    const provider = new TestProvider({ apiKey: 'k' });

    expect(
      provider.validateParams({
        ...baseParams,
        input: {
          type: 'image-to-video',
          prompt: 'x',
          image: { url: 'https://example.com/a.png', mediaType: 'image/png' },
        },
      }),
    ).toEqual({
      valid: false,
      errors: expect.arrayContaining([expect.stringContaining('image-to-video')]),
    });

    expect(
      provider.validateParams({
        ...baseParams,
        duration: 99,
        aspectRatio: '21:9',
        quality: 'pro',
        audio: true,
      }),
    ).toEqual({
      valid: false,
      errors: expect.arrayContaining([
        expect.stringContaining('Duration'),
        expect.stringContaining('Aspect ratio'),
        expect.stringContaining('Quality'),
        expect.stringContaining('audio'),
      ]),
    });

    expect(provider.validateParams(baseParams)).toEqual({ valid: true });
  });

  it('generate yields invalid params error', async () => {
    const provider = new TestProvider({ apiKey: 'k' });
    const events = await collect(provider, { ...baseParams, duration: 99 });
    expect(events[0]).toMatchObject({ type: 'error', error: { code: 'INVALID_PARAMS' } });
  });

  it('generate yields createTask errors', async () => {
    const provider = new TestProvider({ apiKey: 'k' });
    provider.createTaskImpl = async () => {
      throw new Error('rate limit exceeded');
    };
    const events = await collect(provider);
    expect(events[0]).toMatchObject({ type: 'error', error: { code: 'RATE_LIMIT' } });
  });

  it('generate yields completed video', async () => {
    const provider = new TestProvider({ apiKey: 'k', pollInterval: 1 });
    const events = await collect(provider);
    expect(events).toEqual([
      {
        type: 'video',
        video: { url: 'https://v.example/1.mp4', mimeType: 'video/mp4' },
      },
    ]);
  });

  it('generate yields error when completed without result', async () => {
    const provider = new TestProvider({ apiKey: 'k', pollInterval: 1 });
    provider.pollImpl = async () => ({ taskId: 'task-1', status: 'completed' });
    const events = await collect(provider);
    expect(events[0]).toMatchObject({ type: 'error', error: { code: 'GENERATION_FAILED' } });
  });

  it('generate yields failed and cancelled states', async () => {
    const provider = new TestProvider({ apiKey: 'k', pollInterval: 1 });
    provider.pollImpl = async () => ({
      taskId: 'task-1',
      status: 'failed',
      error: { code: 'CONTENT_POLICY', message: 'blocked' },
    });
    expect((await collect(provider))[0]).toMatchObject({
      type: 'error',
      error: { code: 'CONTENT_POLICY' },
    });

    provider.pollImpl = async () => ({ taskId: 'task-1', status: 'cancelled' });
    expect((await collect(provider))[0]).toMatchObject({
      type: 'error',
      error: { message: expect.stringContaining('cancelled') },
    });

    provider.pollImpl = async () => ({ taskId: 'task-1', status: 'failed' });
    expect((await collect(provider))[0]).toMatchObject({
      type: 'error',
      error: { code: 'GENERATION_FAILED' },
    });
  });

  it('generate emits progress while processing then completes', async () => {
    const provider = new TestProvider({ apiKey: 'k', pollInterval: 1 });
    let calls = 0;
    provider.pollImpl = async () => {
      calls += 1;
      if (calls === 1) {
        return { taskId: 'task-1', status: 'processing', progress: 40, stage: 'render' };
      }
      return {
        taskId: 'task-1',
        status: 'completed',
        result: { url: 'https://v.example/1.mp4', mimeType: 'video/mp4' },
      };
    };

    const events = await collect(provider);
    expect(events[0]).toMatchObject({ type: 'progress', progress: 40, stage: 'render' });
    expect(events.at(-1)).toMatchObject({ type: 'video' });
  });

  it('generate yields poll errors', async () => {
    const provider = new TestProvider({ apiKey: 'k', pollInterval: 1 });
    provider.pollImpl = async () => {
      throw new Error('network down');
    };
    const events = await collect(provider);
    expect(events[0]).toMatchObject({ type: 'error', error: { code: 'NETWORK_ERROR' } });
  });

  it('generate yields abort error when signal already aborted', async () => {
    const provider = new TestProvider({ apiKey: 'k', pollInterval: 1 });
    const controller = new AbortController();
    controller.abort();
    const events = await collect(provider, baseParams, controller.signal);
    expect(events[0]).toMatchObject({
      type: 'error',
      error: { code: 'NETWORK_ERROR', message: 'Request aborted' },
    });
  });
});
