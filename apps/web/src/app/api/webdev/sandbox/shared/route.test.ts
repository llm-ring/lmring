import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockRequest, parseJsonResponse, setupTestEnvironment } from '@/test/helpers';
import { POST } from './route';

const {
  mockDbInstance,
  mockGetWebDevConfig,
  mockGetSandboxCredentials,
  mockSandboxCreate,
  mockWaitForPortReady,
} = vi.hoisted(() => {
  return {
    mockDbInstance: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    },
    mockGetWebDevConfig: vi.fn().mockReturnValue({ enabled: true }),
    mockGetSandboxCredentials: vi.fn().mockReturnValue({
      token: 'tok',
      teamId: 'team',
      projectId: 'proj',
    }),
    mockSandboxCreate: vi.fn(),
    mockWaitForPortReady: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@lmring/database', () => ({
  db: mockDbInstance,
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock('@lmring/database/schema', () => ({
  sharedResults: {
    shareToken: 'shareToken',
    conversationId: 'conversationId',
    expiresAt: 'expiresAt',
  },
  webdevSessions: {
    id: 'id',
    conversationId: 'conversationId',
  },
  webdevResponses: {
    id: 'id',
    files: 'files',
    sessionId: 'sessionId',
  },
}));

vi.mock('@vercel/sandbox', () => {
  class APIError extends Error {
    response?: { status?: number };
    json?: unknown;
    text?: string;
    constructor(message: string) {
      super(message);
      this.name = 'APIError';
    }
  }
  return {
    APIError,
    Sandbox: {
      create: mockSandboxCreate,
    },
  };
});

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('sharedsandbox001'),
}));

vi.mock('@/libs/webdev-config', () => ({
  getSandboxCredentials: mockGetSandboxCredentials,
  getWebDevConfig: mockGetWebDevConfig,
}));

vi.mock('@/libs/webdev-sandbox', () => ({
  waitForPortReady: mockWaitForPortReady,
}));

vi.mock('@/libs/error-logging', () => ({
  logError: vi.fn(),
}));

setupTestEnvironment();

const validUUID = '550e8400-e29b-41d4-a716-446655440000';
const validBody = {
  shareToken: 'share-token-abc',
  responseId: validUUID,
};

function makeSandbox(overrides: Record<string, unknown> = {}) {
  return {
    name: 'webdev-shared-sharedsandbox001',
    domain: vi.fn().mockReturnValue('https://shared-preview.example.com'),
    writeFiles: vi.fn().mockResolvedValue(undefined),
    runCommand: vi.fn().mockImplementation(async (cmdOrOpts: unknown) => {
      if (typeof cmdOrOpts === 'string') {
        return { exitCode: 0, stderr: async () => '' };
      }
      return { exitCode: 0 };
    }),
    stop: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

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

function resetDb() {
  mockDbInstance.select.mockReset().mockReturnValue(mockDbInstance);
  mockDbInstance.from.mockReset().mockReturnValue(mockDbInstance);
  mockDbInstance.where.mockReset().mockReturnValue(mockDbInstance);
  mockDbInstance.limit.mockReset().mockReturnValue(mockDbInstance);
  mockGetWebDevConfig.mockReturnValue({ enabled: true });
  mockWaitForPortReady.mockResolvedValue(undefined);
  mockSandboxCreate.mockReset().mockResolvedValue(makeSandbox());
}

describe('WebDev Shared Sandbox API', () => {
  beforeEach(() => {
    resetDb();
  });

  describe('POST /api/webdev/sandbox/shared', () => {
    it('returns 400 when validation fails', async () => {
      const request = createMockRequest('POST', 'http://localhost:3000/api/webdev/sandbox/shared', {
        shareToken: '',
        responseId: 'bad',
      });
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });

    it('returns 404 for invalid share token', async () => {
      mockDbInstance.limit.mockResolvedValueOnce([]);

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox/shared',
        validBody,
      );
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(404);
      expect(data.error).toBe('Invalid share token');
    });

    it('returns 410 when share link expired', async () => {
      mockDbInstance.limit.mockResolvedValueOnce([
        {
          shareToken: 'share-token-abc',
          conversationId: 'conv-1',
          expiresAt: new Date(Date.now() - 1000),
        },
      ]);

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox/shared',
        validBody,
      );
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(410);
      expect(data.error).toBe('Share link has expired');
    });

    it('returns 400 when conversation is not webdev', async () => {
      mockDbInstance.limit
        .mockResolvedValueOnce([
          {
            shareToken: 'share-token-abc',
            conversationId: 'conv-1',
            expiresAt: null,
          },
        ])
        .mockResolvedValueOnce([]);

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox/shared',
        validBody,
      );
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe('Not a webdev conversation');
    });

    it('returns 404 when response has no files', async () => {
      mockDbInstance.limit
        .mockResolvedValueOnce([
          {
            shareToken: 'share-token-abc',
            conversationId: 'conv-1',
            expiresAt: null,
          },
        ])
        .mockResolvedValueOnce([{ id: 'ws-1' }])
        .mockResolvedValueOnce([{ id: validUUID, files: null }]);

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox/shared',
        validBody,
      );
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(404);
      expect(data.error).toBe('Response not found or has no files');
    });

    it('returns 400 when webdev not configured', async () => {
      mockDbInstance.limit
        .mockResolvedValueOnce([
          {
            shareToken: 'share-token-abc',
            conversationId: 'conv-1',
            expiresAt: null,
          },
        ])
        .mockResolvedValueOnce([{ id: 'ws-1' }])
        .mockResolvedValueOnce([
          {
            id: validUUID,
            files: { 'src/App.tsx': 'export default () => null' },
          },
        ]);
      mockGetWebDevConfig.mockReturnValue({ enabled: false, reason: 'no creds' });

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox/shared',
        validBody,
      );
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe('WebDev sandbox is not configured');
    });

    it('streams sandbox-ready on full rebuild', async () => {
      mockDbInstance.limit
        .mockResolvedValueOnce([
          {
            shareToken: 'share-token-abc',
            conversationId: 'conv-1',
            expiresAt: null,
          },
        ])
        .mockResolvedValueOnce([{ id: 'ws-1' }])
        .mockResolvedValueOnce([
          {
            id: validUUID,
            files: {
              'package.json': JSON.stringify({ dependencies: { vite: '5' } }),
              'src/App.tsx': 'export default () => null',
            },
          },
        ]);

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox/shared',
        validBody,
        { 'x-forwarded-for': '203.0.113.10' },
      );
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');

      const events = await readSseEvents(response);
      const types = events.map((e) => (typeof e === 'string' ? e : e.type));

      expect(types).toContain('sandbox-creating');
      expect(types).toContain('sandbox-installing');
      expect(types).toContain('sandbox-ready');
      expect(types).toContain('complete');
      expect(types).toContain('[DONE]');
    });

    it('restores from snapshot when snapshotId provided', async () => {
      mockDbInstance.limit
        .mockResolvedValueOnce([
          {
            shareToken: 'share-token-abc',
            conversationId: 'conv-1',
            expiresAt: null,
          },
        ])
        .mockResolvedValueOnce([{ id: 'ws-1' }])
        .mockResolvedValueOnce([
          {
            id: validUUID,
            files: { 'src/App.tsx': 'export default () => null' },
          },
        ]);

      const sandbox = makeSandbox();
      mockSandboxCreate.mockResolvedValueOnce(sandbox);

      const request = createMockRequest('POST', 'http://localhost:3000/api/webdev/sandbox/shared', {
        ...validBody,
        snapshotId: 'snap-1',
      });
      const response = await POST(request);
      const events = await readSseEvents(response);
      const types = events.map((e) => (typeof e === 'string' ? e : e.type));

      expect(types).toContain('sandbox-ready');
      expect(types).not.toContain('sandbox-installing');
      expect(mockSandboxCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          source: { type: 'snapshot', snapshotId: 'snap-1' },
        }),
      );
    });

    it('emits error when rebuild fails', async () => {
      mockDbInstance.limit
        .mockResolvedValueOnce([
          {
            shareToken: 'share-token-abc',
            conversationId: 'conv-1',
            expiresAt: null,
          },
        ])
        .mockResolvedValueOnce([{ id: 'ws-1' }])
        .mockResolvedValueOnce([
          {
            id: validUUID,
            files: { 'src/App.tsx': 'export default () => null' },
          },
        ]);

      mockSandboxCreate.mockRejectedValueOnce(new Error('create failed'));

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox/shared',
        validBody,
      );
      const response = await POST(request);
      const events = await readSseEvents(response);
      const errorEvent = events.find((e) => typeof e !== 'string' && e.type === 'error') as
        | Record<string, unknown>
        | undefined;

      expect(errorEvent?.message).toBe('create failed');
    });

    it('returns 500 on unexpected top-level error', async () => {
      mockDbInstance.limit.mockImplementationOnce(() => {
        throw new Error('unexpected');
      });

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox/shared',
        validBody,
      );
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});
