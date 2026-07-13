import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockRequest, parseJsonResponse, setupTestEnvironment } from '@/test/helpers';
import { POST } from './route';

const {
  mockAuthInstance,
  mockFetchUserApiKeys,
  mockGenerateVideo,
  mockGetRuntimeProvider,
  mockGetRuntimeModelId,
  mockCreateStorageService,
  mockExtractApiErrorMessage,
} = vi.hoisted(() => {
  const mockSession = {
    session: {
      id: 'test-session-id',
      userId: 'test-user-id',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      token: 'test-token',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      emailVerified: true,
      name: 'Test User',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  return {
    mockAuthInstance: {
      api: {
        getSession: vi.fn().mockResolvedValue(mockSession),
      },
    },
    mockFetchUserApiKeys: vi.fn(),
    mockGenerateVideo: vi.fn(),
    mockGetRuntimeProvider: vi.fn().mockReturnValue('together'),
    mockGetRuntimeModelId: vi.fn().mockReturnValue('together-model'),
    mockCreateStorageService: vi.fn(),
    mockExtractApiErrorMessage: vi.fn((error: unknown) =>
      error instanceof Error ? error.message : 'Unknown error',
    ),
  };
});

vi.mock('@/libs/Auth', () => ({
  auth: mockAuthInstance,
}));

vi.mock('@/libs/provider-factory', () => ({
  fetchUserApiKeys: mockFetchUserApiKeys,
}));

vi.mock('@lmring/ai-hub', () => ({
  generateVideo: mockGenerateVideo,
}));

vi.mock('@lmring/model-depot/utils', () => ({
  getRuntimeProvider: mockGetRuntimeProvider,
  getRuntimeModelId: mockGetRuntimeModelId,
}));

vi.mock('@lmring/storage', () => ({
  createStorageService: mockCreateStorageService,
}));

vi.mock('@/libs/api-error-utils', () => ({
  extractApiErrorMessage: mockExtractApiErrorMessage,
}));

vi.mock('@/libs/error-logging', () => ({
  logError: vi.fn(),
}));

setupTestEnvironment();

const validUUID = 'aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa';
const keyId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

async function readSseEvents(response: Response): Promise<Array<Record<string, unknown> | string>> {
  const text = await response.text();
  const events: Array<Record<string, unknown> | string> = [];
  for (const block of text.split('\n\n')) {
    const line = block.trim();
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6);
    if (payload === '[DONE]') {
      events.push('[DONE]');
    } else {
      events.push(JSON.parse(payload) as Record<string, unknown>);
    }
  }
  return events;
}

async function* videoEvents(
  events: Array<Record<string, unknown>>,
): AsyncGenerator<Record<string, unknown>> {
  for (const event of events) {
    yield event;
  }
}

describe('Video Stream API', () => {
  beforeEach(() => {
    mockFetchUserApiKeys.mockReset();
    mockGenerateVideo.mockReset();
    mockGetRuntimeProvider.mockReturnValue('together');
    mockGetRuntimeModelId.mockReturnValue('together-model');
    mockCreateStorageService.mockReset();
  });

  describe('POST /api/workflow/video-stream', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuthInstance.api.getSession.mockResolvedValueOnce(null);

      const request = createMockRequest('POST', 'http://localhost:3000/api/workflow/video-stream', {
        workflowId: validUUID,
        modelId: 'video-model',
        keyId,
        prompt: 'A cat dancing',
      });
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 400 when validation fails', async () => {
      const request = createMockRequest('POST', 'http://localhost:3000/api/workflow/video-stream', {
        workflowId: 'bad',
        modelId: '',
        keyId: 'bad',
        prompt: '',
      });
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });

    it('returns 403 when API key is missing', async () => {
      mockFetchUserApiKeys.mockResolvedValueOnce(new Map());

      const request = createMockRequest('POST', 'http://localhost:3000/api/workflow/video-stream', {
        workflowId: validUUID,
        modelId: 'video-model',
        keyId,
        prompt: 'A cat dancing',
      });
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(403);
      expect(data.error).toBe('API key not found or not authorized');
      expect(data.keyId).toBe(keyId);
    });

    it('streams heartbeat, video, complete events and re-uploads to storage', async () => {
      mockFetchUserApiKeys.mockResolvedValueOnce(
        new Map([[keyId, { apiKey: 'sk-test', proxyUrl: null }]]),
      );

      const upload = vi.fn().mockResolvedValue(undefined);
      const createDownloadUrl = vi.fn().mockResolvedValue('https://storage.example.com/video.mp4');
      mockCreateStorageService.mockReturnValue({ upload, createDownloadUrl });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      }) as unknown as typeof fetch;

      mockGenerateVideo.mockReturnValueOnce(
        videoEvents([
          { type: 'heartbeat' },
          {
            type: 'video',
            video: {
              url: 'https://together.example.com/tmp.mp4',
              mimeType: 'video/mp4',
              thumbnailUrl: 'https://together.example.com/thumb.jpg',
            },
          },
        ]),
      );

      try {
        const request = createMockRequest(
          'POST',
          'http://localhost:3000/api/workflow/video-stream',
          {
            workflowId: validUUID,
            modelId: 'video-model',
            keyId,
            prompt: 'A cat dancing',
          },
        );
        const response = await POST(request);

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('text/event-stream');

        const events = await readSseEvents(response);
        const types = events.map((e) => (typeof e === 'string' ? e : e.type));

        expect(types).toContain('heartbeat');
        expect(types).toContain('video');
        expect(types).toContain('complete');
        expect(types).toContain('[DONE]');

        const videoEvent = events.find(
          (e) => typeof e !== 'string' && e.type === 'video',
        ) as Record<string, unknown>;
        const video = videoEvent.video as { url: string; storagePath?: string };
        expect(video.url).toBe('https://storage.example.com/video.mp4');
        expect(video.storagePath).toContain('users/test-user-id/videos/');
        expect(upload).toHaveBeenCalled();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('falls back to original URL when storage upload fails', async () => {
      mockFetchUserApiKeys.mockResolvedValueOnce(
        new Map([[keyId, { apiKey: 'sk-test', proxyUrl: 'https://proxy' }]]),
      );
      mockCreateStorageService.mockReturnValue({
        upload: vi.fn().mockRejectedValue(new Error('upload fail')),
        createDownloadUrl: vi.fn(),
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1]).buffer,
      }) as unknown as typeof fetch;

      mockGenerateVideo.mockReturnValueOnce(
        videoEvents([
          {
            type: 'video',
            video: {
              url: 'https://together.example.com/tmp.mp4',
              mimeType: 'video/mp4',
            },
          },
        ]),
      );

      try {
        const request = createMockRequest(
          'POST',
          'http://localhost:3000/api/workflow/video-stream',
          {
            workflowId: validUUID,
            modelId: 'video-model',
            keyId,
            prompt: 'prompt',
          },
        );
        const response = await POST(request);
        const events = await readSseEvents(response);
        const videoEvent = events.find(
          (e) => typeof e !== 'string' && e.type === 'video',
        ) as Record<string, unknown>;
        const video = videoEvent.video as { url: string };
        expect(video.url).toBe('https://together.example.com/tmp.mp4');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('streams error events from generator', async () => {
      mockFetchUserApiKeys.mockResolvedValueOnce(
        new Map([[keyId, { apiKey: 'sk-test', proxyUrl: null }]]),
      );
      mockGenerateVideo.mockReturnValueOnce(
        videoEvents([{ type: 'error', error: 'model overloaded' }]),
      );

      const request = createMockRequest('POST', 'http://localhost:3000/api/workflow/video-stream', {
        workflowId: validUUID,
        modelId: 'video-model',
        keyId,
        prompt: 'prompt',
      });
      const response = await POST(request);
      const events = await readSseEvents(response);
      const errorEvent = events.find((e) => typeof e !== 'string' && e.type === 'error') as Record<
        string,
        unknown
      >;

      expect(errorEvent.error).toBe('model overloaded');
      expect(events).toContain('[DONE]');
    });

    it('emits error when generator throws', async () => {
      mockFetchUserApiKeys.mockResolvedValueOnce(
        new Map([[keyId, { apiKey: 'sk-test', proxyUrl: null }]]),
      );
      mockGenerateVideo.mockImplementationOnce(async function* () {
        yield* [];
        throw new Error('stream broke');
      });

      const request = createMockRequest('POST', 'http://localhost:3000/api/workflow/video-stream', {
        workflowId: validUUID,
        modelId: 'video-model',
        keyId,
        prompt: 'prompt',
      });
      const response = await POST(request);
      const events = await readSseEvents(response);
      const errorEvent = events.find((e) => typeof e !== 'string' && e.type === 'error') as Record<
        string,
        unknown
      >;

      expect(errorEvent.error).toBe('stream broke');
      expect(events).toContain('[DONE]');
    });

    it('returns 500 when top-level handler throws', async () => {
      mockFetchUserApiKeys.mockRejectedValueOnce(new Error('keys fail'));

      const request = createMockRequest('POST', 'http://localhost:3000/api/workflow/video-stream', {
        workflowId: validUUID,
        modelId: 'video-model',
        keyId,
        prompt: 'prompt',
      });
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});
