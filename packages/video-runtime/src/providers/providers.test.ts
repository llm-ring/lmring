import { afterEach, describe, expect, it, vi } from 'vitest';
import * as http from '../utils/http';
import { DashScopeVideoProvider } from './dashscope';
import { GoogleVideoProvider } from './google';
import { KlingVideoProvider } from './kling';
import { createMiniMaxProvider, MiniMaxVideoProvider } from './minimax';
import { createOpenAIProvider, OpenAIVideoProvider } from './openai';
import { createOpenAICompatibleProvider, OpenAICompatibleVideoProvider } from './openai-compatible';
import { SeedanceVideoProvider } from './seedance';
import { ViduVideoProvider } from './vidu';

type AnyProvider = {
  createTask: (params: unknown, signal?: AbortSignal) => Promise<string>;
  pollTaskStatus: (taskId: string, signal?: AbortSignal) => Promise<unknown>;
  resolveModelId: (modelId: string) => string;
  generate: (params: unknown, signal?: AbortSignal) => AsyncGenerator<unknown>;
};

function asTestable(provider: object): AnyProvider {
  return provider as unknown as AnyProvider;
}

const textParams = {
  model: 'test-model',
  input: { type: 'text-to-video' as const, prompt: 'A cat' },
  duration: 5,
  aspectRatio: '16:9' as const,
  quality: 'standard' as const,
  width: 1280,
  height: 720,
};

const imageParams = {
  model: 'test-model',
  input: {
    type: 'image-to-video' as const,
    prompt: 'Animate',
    image: { url: 'https://example.com/a.png', mediaType: 'image/png' as const },
  },
};

const imageBase64Params = {
  model: 'test-model',
  input: {
    type: 'image-to-video' as const,
    prompt: 'Animate',
    image: { base64: 'abc123', mediaType: 'image/jpeg' as const },
  },
};

function mockHttp(data: unknown, status = 200) {
  return vi.spyOn(http, 'httpRequest').mockResolvedValue({
    status,
    statusText: 'OK',
    data,
    headers: new Headers(),
  });
}

describe('OpenAIVideoProvider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('resolveModelId maps sora alias and strips prefix', () => {
    const p = new OpenAIVideoProvider({ apiKey: 'k' });
    expect(p.resolveModelId('openai/sora')).toBe('sora-2');
    expect(p.resolveModelId('openai/sora-2')).toBe('sora-2');
    expect(createOpenAIProvider({ apiKey: 'k' }).providerId).toBe('openai');
  });

  it('createTask posts T2V and I2V payloads', async () => {
    const p = asTestable(new OpenAIVideoProvider({ apiKey: 'k' }));
    const spy = mockHttp({ id: 'task-1' });

    await expect(p.createTask(textParams)).resolves.toBe('task-1');
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('/videos'),
      expect.objectContaining({ method: 'POST' }),
    );

    await p.createTask(imageParams);
    await p.createTask(imageBase64Params);
    const lastBody = spy.mock.calls.at(-1)?.[1]?.body as { image_url?: string };
    expect(lastBody.image_url).toContain('data:image/jpeg;base64,abc123');
  });

  it('createTask throws when id missing', async () => {
    const p = asTestable(new OpenAIVideoProvider({ apiKey: 'k' }));
    mockHttp({});
    await expect(p.createTask(textParams)).rejects.toThrow(/No task ID/);
  });

  it('pollTaskStatus maps statuses and results', async () => {
    const p = asTestable(new OpenAIVideoProvider({ apiKey: 'k' }));
    mockHttp({
      id: 't1',
      status: 'completed',
      video_url: 'https://v.example/a.mp4',
      progress: 100,
    });
    await expect(p.pollTaskStatus('t1')).resolves.toMatchObject({
      status: 'completed',
      result: { url: 'https://v.example/a.mp4' },
    });

    mockHttp({ id: 't1', status: 'failed', error: { code: 'x', message: 'nope' } });
    await expect(p.pollTaskStatus('t1')).resolves.toMatchObject({
      status: 'failed',
      error: { message: 'nope' },
    });

    for (const status of [
      'queued',
      'pending',
      'processing',
      'in_progress',
      'succeeded',
      'error',
      'cancelled',
      'canceled',
      'weird',
    ]) {
      mockHttp({ id: 't1', status });
      const state = (await p.pollTaskStatus('t1')) as { status: string };
      expect(state.status).toBeTruthy();
    }
  });

  it('createTask uses all aspect ratios via width/height and ratio', async () => {
    const p = asTestable(new OpenAIVideoProvider({ apiKey: 'k' }));
    const spy = mockHttp({ id: 't' });
    for (const aspectRatio of ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '2:1'] as const) {
      await p.createTask({ ...textParams, aspectRatio, width: undefined, height: undefined });
    }
    await p.createTask({ ...textParams, width: 100, height: 200, aspectRatio: undefined });
    expect(spy).toHaveBeenCalled();
  });
});

describe('MiniMaxVideoProvider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('resolveModelId maps hailuo aliases', () => {
    const p = new MiniMaxVideoProvider({ apiKey: 'k' });
    expect(p.resolveModelId('minimax/hailuo')).toBe('video-01');
    expect(p.resolveModelId('hailuo-2.3')).toBe('video-01');
    expect(p.resolveModelId('hailuo-custom')).toBe('video-01');
    expect(p.resolveModelId('other')).toBe('other');
    expect(createMiniMaxProvider({ apiKey: 'k' }).providerId).toBe('minimax');
  });

  it('createTask and pollTaskStatus cover success and error paths', async () => {
    const p = asTestable(new MiniMaxVideoProvider({ apiKey: 'k' }));
    const spy = mockHttp({ base_resp: { status_code: 0 }, task_id: 'm1' });

    await expect(p.createTask(textParams)).resolves.toBe('m1');
    await p.createTask(imageParams);
    await p.createTask(imageBase64Params);
    await p.createTask({
      ...textParams,
      aspectRatio: '9:16',
      quality: 'high',
    });
    await p.createTask({ ...textParams, quality: 'pro' });
    await p.createTask({ ...textParams, quality: 'master' });
    await p.createTask({ ...textParams, quality: undefined, aspectRatio: '21:9' });

    mockHttp({ base_resp: { status_code: 1, status_msg: 'fail' } });
    await expect(p.createTask(textParams)).rejects.toThrow(/fail/);

    mockHttp({ base_resp: { status_code: 0 } });
    await expect(p.createTask(textParams)).rejects.toThrow(/No task ID/);

    // poll success with file retrieval
    spy.mockReset();
    spy
      .mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        data: { base_resp: { status_code: 0 }, status: 'success', file_id: 'f1' },
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        data: {
          base_resp: { status_code: 0 },
          file: { download_url: 'https://v.example/m.mp4' },
        },
        headers: new Headers(),
      });
    await expect(p.pollTaskStatus('m1')).resolves.toMatchObject({
      status: 'completed',
      result: { url: 'https://v.example/m.mp4' },
    });

    mockHttp({ base_resp: { status_code: 2, status_msg: 'poll fail' } });
    await expect(p.pollTaskStatus('m1')).resolves.toMatchObject({ status: 'failed' });

    for (const status of [
      'queueing',
      'queued',
      'processing',
      'running',
      'failed',
      'error',
      'cancelled',
      'x',
    ]) {
      mockHttp({ base_resp: { status_code: 0 }, status });
      await p.pollTaskStatus('m1');
    }

    // getFileUrl error path via completed poll
    spy.mockReset();
    spy
      .mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        data: { base_resp: { status_code: 0 }, status: 'completed', file_id: 'f2' },
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        data: { base_resp: { status_code: 9, status_msg: 'file err' } },
        headers: new Headers(),
      });
    await expect(p.pollTaskStatus('m1')).rejects.toThrow(/file err/);
  });
});

describe('GoogleVideoProvider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('createTask and pollTaskStatus handle async and sync completion', async () => {
    const p = asTestable(new GoogleVideoProvider({ apiKey: 'k' }));
    expect(p.resolveModelId('google/veo')).toBe('veo-2.0-generate-001');
    expect(p.resolveModelId('veo-3')).toBe('veo-2.0-generate-001');
    expect(p.resolveModelId('custom-model')).toBe('custom-model');

    mockHttp({ name: 'operations/op1' });
    await expect(p.createTask(textParams)).resolves.toBe('operations/op1');
    await p.createTask(imageParams);
    await p.createTask(imageBase64Params);
    for (const aspectRatio of ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'] as const) {
      await p.createTask({ ...textParams, aspectRatio });
    }

    mockHttp({ done: true, response: { candidates: [{ video: { uri: 'https://v' } }] } });
    await expect(p.createTask(textParams)).resolves.toBe('sync-completed');

    mockHttp({});
    await expect(p.createTask(textParams)).rejects.toThrow(/No operation name/);

    await expect(p.pollTaskStatus('sync-completed')).resolves.toMatchObject({
      status: 'completed',
    });

    mockHttp({
      done: true,
      response: {
        candidates: [
          {
            content: {
              parts: [
                {
                  fileData: {
                    fileUri: 'https://v.example/g.mp4',
                    mimeType: 'video/mp4',
                  },
                },
              ],
            },
          },
        ],
      },
    });
    await expect(p.pollTaskStatus('operations/op1')).resolves.toMatchObject({
      status: 'completed',
      result: { url: 'https://v.example/g.mp4' },
    });

    mockHttp({ done: true, error: { message: 'bad' } });
    await expect(p.pollTaskStatus('operations/op1')).resolves.toMatchObject({
      status: 'failed',
    });

    mockHttp({ done: false });
    await expect(p.pollTaskStatus('operations/op1')).resolves.toMatchObject({
      status: 'processing',
    });
  });
});

describe('KlingVideoProvider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('createTask and poll cover branches', async () => {
    const p = asTestable(new KlingVideoProvider({ apiKey: 'k' }));
    expect(p.resolveModelId('kling')).toBe('kling-v2-master');
    expect(p.resolveModelId('kling-v1')).toBe('kling-v1');
    expect(p.resolveModelId('other')).toBe('other');

    mockHttp({ code: 0, data: { task_id: 'k1' } });
    await expect(p.createTask(textParams)).resolves.toBe('k1');
    await p.createTask(imageParams);
    await p.createTask(imageBase64Params);
    for (const aspectRatio of ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '2:1'] as const) {
      await p.createTask({ ...textParams, aspectRatio });
    }

    await expect(
      p.createTask({
        ...imageParams,
        input: {
          type: 'image-to-video',
          prompt: 'x',
          image: { mediaType: 'image/png' },
        },
      }),
    ).rejects.toThrow(/Image URL or base64 required/);

    mockHttp({ code: 1, message: 'kling fail' });
    await expect(p.createTask(textParams)).rejects.toThrow(/kling fail/);

    mockHttp({ code: 0, data: {} });
    await expect(p.createTask(textParams)).rejects.toThrow(/No task ID/);

    mockHttp({
      code: 0,
      data: {
        task_status: 'succeed',
        task_result: { videos: [{ url: 'https://v.example/k.mp4' }] },
      },
    });
    // mapStatus may use different success tokens
    mockHttp({
      code: 0,
      data: {
        task_status: 'completed',
        task_result: { videos: [{ url: 'https://v.example/k.mp4' }] },
      },
    });
    await expect(p.pollTaskStatus('k1')).resolves.toMatchObject({ status: 'completed' });

    mockHttp({ code: 1, message: 'poll fail' });
    await expect(p.pollTaskStatus('k1')).resolves.toMatchObject({ status: 'failed' });

    mockHttp({ code: 0, data: { task_status: 'failed', task_status_msg: 'nope' } });
    await expect(p.pollTaskStatus('k1')).resolves.toMatchObject({
      status: 'failed',
      error: { message: 'nope' },
    });

    for (const task_status of [
      'submitted',
      'processing',
      'succeed',
      'failed',
      'canceled',
      'unknown',
    ]) {
      mockHttp({ code: 0, data: { task_status } });
      await p.pollTaskStatus('k1');
    }
  });
});

describe('SeedanceVideoProvider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('createTask and poll cover branches', async () => {
    const p = asTestable(new SeedanceVideoProvider({ apiKey: 'k' }));
    expect(p.resolveModelId('seedance')).toBe('seedance-1.0-pro');
    expect(p.resolveModelId('custom')).toBe('custom');

    mockHttp({ code: 0, data: { task_id: 's1' } });
    await expect(p.createTask(textParams)).resolves.toBe('s1');
    mockHttp({ code: 200, data: { task_id: 's2' } });
    await expect(p.createTask(imageParams)).resolves.toBe('s2');
    await p.createTask(imageBase64Params);
    for (const aspectRatio of ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'] as const) {
      await p.createTask({ ...textParams, aspectRatio });
    }

    await expect(
      p.createTask({
        ...imageParams,
        input: { type: 'image-to-video', prompt: 'x', image: { mediaType: 'image/png' } },
      }),
    ).rejects.toThrow(/Image URL or base64 required/);

    mockHttp({ code: 1, message: 'seed fail' });
    await expect(p.createTask(textParams)).rejects.toThrow(/seed fail/);
    mockHttp({ code: 0, data: {} });
    await expect(p.createTask(textParams)).rejects.toThrow(/No task ID/);

    mockHttp({ code: 0, data: { status: 'completed', video_url: 'https://v.example/s.mp4' } });
    await expect(p.pollTaskStatus('s1')).resolves.toMatchObject({ status: 'completed' });

    mockHttp({ code: 3, message: 'poll fail' });
    await expect(p.pollTaskStatus('s1')).resolves.toMatchObject({ status: 'failed' });

    mockHttp({ code: 0, data: { status: 'failed', message: 'bad' } });
    await expect(p.pollTaskStatus('s1')).resolves.toMatchObject({ status: 'failed' });

    for (const status of [
      'queued',
      'running',
      'processing',
      'succeeded',
      'failed',
      'cancelled',
      'x',
    ]) {
      mockHttp({ code: 200, data: { status } });
      await p.pollTaskStatus('s1');
    }
    mockHttp({ code: 0, data: null });
    await p.pollTaskStatus('s1');
  });
});

describe('ViduVideoProvider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('createTask and poll cover branches', async () => {
    const p = asTestable(new ViduVideoProvider({ apiKey: 'k' }));
    expect(p.resolveModelId('vidu')).toBe('vidu-2.0');
    expect(p.resolveModelId('vidu-1.5')).toBe('vidu-1.5');
    expect(p.resolveModelId('custom')).toBe('custom');

    mockHttp({ id: 'v1', status: 'created' });
    await expect(p.createTask(textParams)).resolves.toBe('v1');
    await p.createTask(imageParams);
    await p.createTask(imageBase64Params);
    for (const aspectRatio of ['16:9', '9:16', '1:1', '21:9'] as const) {
      await p.createTask({ ...textParams, aspectRatio });
    }

    mockHttp({ error: { message: 'no id' } });
    await expect(p.createTask(textParams)).rejects.toThrow(/no id/);

    mockHttp({
      id: 'v1',
      status: 'completed',
      video_url: 'https://v.example/v.mp4',
      progress: 100,
    });
    await expect(p.pollTaskStatus('v1')).resolves.toMatchObject({
      status: 'completed',
      result: { url: 'https://v.example/v.mp4' },
    });

    mockHttp({ id: 'v1', status: 'failed', error: { message: 'bad' } });
    await expect(p.pollTaskStatus('v1')).resolves.toMatchObject({ status: 'failed' });

    for (const status of [
      'created',
      'queueing',
      'processing',
      'success',
      'failed',
      'cancelled',
      'x',
    ]) {
      mockHttp({ id: 'v1', status });
      await p.pollTaskStatus('v1');
    }
  });
});

describe('DashScopeVideoProvider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('createTask and poll cover branches and baseURL rewrite', async () => {
    const p = asTestable(new DashScopeVideoProvider({ apiKey: 'k' }));
    expect(p.resolveModelId('dashscope/wanx')).toBe('wanx');

    mockHttp({ output: { task_id: 'd1' } });
    await expect(p.createTask(textParams)).resolves.toBe('d1');
    await p.createTask(imageParams);
    await p.createTask(imageBase64Params);
    for (const aspectRatio of ['16:9', '9:16', '1:1', '21:9'] as const) {
      await p.createTask({ ...textParams, aspectRatio, quality: 'high' });
    }

    await expect(
      p.createTask({
        ...imageParams,
        input: { type: 'image-to-video', prompt: 'x', image: { mediaType: 'image/png' } },
      }),
    ).rejects.toThrow(/Image URL or base64 required/);

    mockHttp({ output: {} });
    await expect(p.createTask(textParams)).rejects.toThrow(/No task ID/);

    mockHttp({ output: { task_status: 'SUCCEEDED', video_url: 'https://v.example/d.mp4' } });
    await expect(p.pollTaskStatus('d1')).resolves.toMatchObject({ status: 'completed' });

    mockHttp({ output: { task_status: 'FAILED', message: 'bad' } });
    await expect(p.pollTaskStatus('d1')).resolves.toMatchObject({ status: 'failed' });

    for (const task_status of [
      'PENDING',
      'RUNNING',
      'SUCCEEDED',
      'FAILED',
      'CANCELED',
      'UNKNOWN',
    ]) {
      mockHttp({ output: { task_status } });
      await p.pollTaskStatus('d1');
    }

    // baseURL variants already covered by dashscope.test.ts; exercise factory path
    const proxy = new DashScopeVideoProvider({
      apiKey: 'k',
      baseURL: 'https://proxy.example.com/v1',
    });
    expect(proxy.defaultBaseURL).toContain('dashscope');
  });
});

describe('OpenAICompatibleVideoProvider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('createTask handles direct completion and task ids', async () => {
    const p = asTestable(
      new OpenAICompatibleVideoProvider({
        apiKey: 'k',
        baseURL: 'https://proxy.example.com/v1',
      }),
    );
    expect(p.resolveModelId('openai/sora-2')).toBeTruthy();
    expect(
      createOpenAICompatibleProvider({ apiKey: 'k', baseURL: 'https://x/v1' }).providerId,
    ).toBe('openai-compatible');

    // direct completion
    mockHttp({ status: 'completed', url: 'https://v.example/direct.mp4' });
    const directId = await p.createTask(textParams);
    expect(directId.startsWith('direct:')).toBe(true);
    await expect(p.pollTaskStatus(directId)).resolves.toMatchObject({
      status: 'completed',
      result: { url: 'https://v.example/direct.mp4' },
    });

    mockHttp({ id: 'c1', status: 'queued' });
    await expect(p.createTask(textParams)).resolves.toBe('c1');

    mockHttp({ task_id: 'c2', status: 'queued' });
    await expect(p.createTask(imageParams)).resolves.toBe('c2');

    mockHttp({ request_id: 'c3', status: 'queued' });
    await expect(p.createTask(imageBase64Params)).resolves.toBe('c3');

    for (const aspectRatio of ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'] as const) {
      mockHttp({ id: 'c', status: 'queued' });
      await p.createTask({ ...textParams, aspectRatio, width: undefined, height: undefined });
    }
    mockHttp({ id: 'c', status: 'queued' });
    await p.createTask({ ...textParams, width: 10, height: 20 });

    mockHttp({ status: 'queued' });
    await expect(p.createTask(textParams)).rejects.toThrow(/No task ID/);

    mockHttp({
      status: 'completed',
      data: [{ url: 'https://v.example/arr.mp4' }],
    });
    await expect(p.pollTaskStatus('c1')).resolves.toMatchObject({ status: 'completed' });

    mockHttp({
      status: 'completed',
      data: { output: 'https://v.example/obj.mp4' },
    });
    await expect(p.pollTaskStatus('c1')).resolves.toMatchObject({ status: 'completed' });

    mockHttp({ status: 'completed', video_url: 'https://v.example/vu.mp4' });
    await expect(p.pollTaskStatus('c1')).resolves.toMatchObject({ status: 'completed' });

    mockHttp({ status: 'failed', error: { code: 'x', message: 'bad' } });
    await expect(p.pollTaskStatus('c1')).resolves.toMatchObject({ status: 'failed' });

    for (const status of [
      'queued',
      'pending',
      'processing',
      'in_progress',
      'completed',
      'succeeded',
      'failed',
      'error',
      'cancelled',
      'canceled',
      'x',
    ]) {
      mockHttp({ status });
      await p.pollTaskStatus('c1');
    }

    // generations endpoint config
    const gen = asTestable(
      new OpenAICompatibleVideoProvider({
        apiKey: 'k',
        baseURL: 'https://proxy.example.com/v1',
        useGenerationsEndpoint: true,
      } as never),
    );
    const spy = mockHttp({ id: 'g1', status: 'queued' });
    await gen.createTask(textParams);
    expect(spy.mock.calls[0]?.[0]).toContain('videos/generations');
  });
});
