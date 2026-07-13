import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockRequest, parseJsonResponse, setupTestEnvironment } from '@/test/helpers';
import { POST } from './route';

const {
  mockAuthInstance,
  mockDbInstance,
  mockCheckSandboxRateLimit,
  mockGetWebDevConfig,
  mockGetSandboxCredentials,
  mockSandboxCreate,
  mockWaitForPortReady,
  mockSnapshotGet,
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
    mockDbInstance: {
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    },
    mockCheckSandboxRateLimit: vi
      .fn()
      .mockResolvedValue({ allowed: true, remaining: 49, limit: 50 }),
    mockGetWebDevConfig: vi.fn().mockReturnValue({ enabled: true }),
    mockGetSandboxCredentials: vi.fn().mockReturnValue({
      token: 'tok',
      teamId: 'team',
      projectId: 'proj',
    }),
    mockSandboxCreate: vi.fn(),
    mockWaitForPortReady: vi.fn().mockResolvedValue(undefined),
    mockSnapshotGet: vi.fn(),
  };
});

vi.mock('@/libs/Auth', () => ({
  auth: mockAuthInstance,
}));

vi.mock('@lmring/database', () => ({
  db: mockDbInstance,
  eq: vi.fn(),
}));

vi.mock('@lmring/database/schema', () => ({
  webdevResponses: {
    id: 'id',
    sandboxId: 'sandboxId',
    previewUrl: 'previewUrl',
    status: 'status',
    expiresAt: 'expiresAt',
    files: 'files',
    snapshotId: 'snapshotId',
    snapshotExpiresAt: 'snapshotExpiresAt',
    error: 'error',
  },
}));

vi.mock('@lmring/env', () => ({
  SANDBOX_CONFIG: {
    SNAPSHOT_EXPIRATION_MS: 7 * 24 * 60 * 60 * 1000,
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
    Snapshot: {
      get: mockSnapshotGet,
    },
  };
});

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('abcdefghijklmnop'),
}));

vi.mock('@/libs/webdev-config', () => ({
  getSandboxCredentials: mockGetSandboxCredentials,
  getWebDevConfig: mockGetWebDevConfig,
}));

vi.mock('@/libs/webdev-resource-manager', () => ({
  checkSandboxRateLimit: mockCheckSandboxRateLimit,
}));

vi.mock('@/libs/webdev-sandbox', () => ({
  waitForPortReady: mockWaitForPortReady,
}));

vi.mock('@/libs/error-logging', () => ({
  logError: vi.fn(),
}));

setupTestEnvironment();

const validUUID = '550e8400-e29b-41d4-a716-446655440000';

function makeSandbox(overrides: Record<string, unknown> = {}) {
  return {
    name: 'webdev-abcdefghijklmnop',
    timeout: 5 * 60 * 1000,
    domain: vi.fn().mockReturnValue('https://preview.example.com'),
    writeFiles: vi.fn().mockResolvedValue(undefined),
    runCommand: vi.fn().mockImplementation(async (cmdOrOpts: unknown) => {
      if (typeof cmdOrOpts === 'string') {
        return { exitCode: 0, stderr: async () => '' };
      }
      return { exitCode: 0 };
    }),
    snapshot: vi.fn().mockResolvedValue({
      snapshotId: 'snap-new',
      expiresAt: new Date(Date.now() + 1000),
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

describe('WebDev Sandbox Create API', () => {
  const validBody = {
    files: [
      { path: 'package.json', content: JSON.stringify({ dependencies: { vite: '^5.0.0' } }) },
      { path: 'src/App.tsx', content: 'export default () => <div/>' },
    ],
    sessionId: validUUID,
    responseId: validUUID,
  };

  beforeEach(() => {
    mockDbInstance.update.mockReset().mockReturnValue(mockDbInstance);
    mockDbInstance.set.mockReset().mockReturnValue(mockDbInstance);
    mockDbInstance.where.mockReset().mockResolvedValue(undefined);
    mockGetWebDevConfig.mockReturnValue({ enabled: true });
    mockCheckSandboxRateLimit.mockResolvedValue({ allowed: true, remaining: 49, limit: 50 });
    mockWaitForPortReady.mockResolvedValue(undefined);

    // Full rebuild creates sandbox, then snapshot restore creates another
    const first = makeSandbox({ name: 'webdev-first' });
    const second = makeSandbox({ name: 'webdev-second' });
    mockSandboxCreate.mockReset().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
  });

  describe('POST /api/webdev/sandbox', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuthInstance.api.getSession.mockResolvedValueOnce(null);

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox',
        validBody,
      );
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 400 when validation fails', async () => {
      const request = createMockRequest('POST', 'http://localhost:3000/api/webdev/sandbox', {
        files: [],
        sessionId: 'bad',
        responseId: 'bad',
      });
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });

    it('returns 400 when webdev is not configured', async () => {
      mockGetWebDevConfig.mockReturnValue({ enabled: false, reason: 'missing token' });

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox',
        validBody,
      );
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe('WebDev sandbox is not configured');
      expect(data.reason).toBe('missing token');
    });

    it('returns 429 when rate limit exceeded', async () => {
      mockCheckSandboxRateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        limit: 50,
      });

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox',
        validBody,
      );
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(429);
      expect(data.error).toBe('Rate limit exceeded');
      expect(data.remaining).toBe(0);
    });

    it('streams full rebuild success events including snapshot', async () => {
      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox',
        validBody,
      );
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');

      const events = await readSseEvents(response);
      const types = events.map((e) => (typeof e === 'string' ? e : e.type));

      expect(types).toContain('sandbox-creating');
      expect(types).toContain('sandbox-installing');
      expect(types).toContain('sandbox-starting');
      expect(types).toContain('sandbox-ready');
      expect(types).toContain('complete');
      expect(types).toContain('snapshot-creating');
      expect(types).toContain('snapshot-ready');
      expect(types).toContain('[DONE]');
      expect(mockDbInstance.update).toHaveBeenCalled();
    });

    it('patches vite config during rebuild', async () => {
      const sandbox = makeSandbox();
      mockSandboxCreate
        .mockReset()
        .mockResolvedValueOnce(sandbox)
        .mockResolvedValueOnce(makeSandbox());

      const body = {
        ...validBody,
        files: [
          {
            path: 'vite.config.ts',
            content: "import { defineConfig } from 'vite';\nexport default defineConfig({});\n",
          },
          { path: 'src/App.tsx', content: 'export default () => <div/>' },
        ],
      };

      const request = createMockRequest('POST', 'http://localhost:3000/api/webdev/sandbox', body);
      const response = await POST(request);
      await readSseEvents(response);

      expect(sandbox.writeFiles).toHaveBeenCalled();
      const written = sandbox.writeFiles.mock.calls[0]?.[0] as
        | Array<{ path: string; content: Buffer }>
        | undefined;
      expect(written).toBeDefined();
      const vite = written?.find((f) => f.path === 'vite.config.ts');
      expect(vite?.content.toString()).toContain('allowedHosts');
    });

    it('restores from snapshot when snapshotId provided', async () => {
      const sandbox = makeSandbox({ name: 'webdev-from-snap' });
      mockSandboxCreate.mockReset().mockResolvedValueOnce(sandbox);

      const request = createMockRequest('POST', 'http://localhost:3000/api/webdev/sandbox', {
        ...validBody,
        snapshotId: 'snap-old',
      });
      const response = await POST(request);
      const events = await readSseEvents(response);
      const types = events.map((e) => (typeof e === 'string' ? e : e.type));

      expect(types).toContain('sandbox-creating');
      expect(types).toContain('sandbox-starting');
      expect(types).toContain('sandbox-ready');
      expect(types).toContain('complete');
      expect(types).toContain('[DONE]');
      // Should not go through full install path
      expect(types).not.toContain('sandbox-installing');
      expect(mockSandboxCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          source: { type: 'snapshot', snapshotId: 'snap-old' },
        }),
      );
    });

    it('falls back to rebuild when snapshot restore fails', async () => {
      const rebuild = makeSandbox({ name: 'webdev-rebuild' });
      const afterSnap = makeSandbox({ name: 'webdev-after-snap' });
      mockSandboxCreate
        .mockReset()
        .mockRejectedValueOnce(new Error('snapshot gone'))
        .mockResolvedValueOnce(rebuild)
        .mockResolvedValueOnce(afterSnap);

      const request = createMockRequest('POST', 'http://localhost:3000/api/webdev/sandbox', {
        ...validBody,
        snapshotId: 'snap-old',
      });
      const response = await POST(request);
      const events = await readSseEvents(response);
      const types = events.map((e) => (typeof e === 'string' ? e : e.type));

      expect(types).toContain('sandbox-installing');
      expect(types).toContain('sandbox-ready');
      expect(types).toContain('[DONE]');
    });

    it('emits error event when npm install fails', async () => {
      const sandbox = makeSandbox({
        runCommand: vi.fn().mockImplementation(async (cmdOrOpts: unknown) => {
          if (typeof cmdOrOpts === 'string') {
            return { exitCode: 1, stderr: async () => 'peer dep conflict' };
          }
          return { exitCode: 0 };
        }),
        stop: vi.fn().mockResolvedValue(undefined),
      });
      mockSandboxCreate.mockReset().mockResolvedValueOnce(sandbox);

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox',
        validBody,
      );
      const response = await POST(request);
      const events = await readSseEvents(response);
      const errorEvent = events.find((e) => typeof e !== 'string' && e.type === 'error') as
        | Record<string, unknown>
        | undefined;

      expect(errorEvent).toBeDefined();
      expect(String(errorEvent?.message)).toContain('npm install failed');
      expect(sandbox.stop).toHaveBeenCalled();
    });

    it('emits snapshot-error when snapshot creation fails (non-fatal)', async () => {
      const sandbox = makeSandbox({
        snapshot: vi.fn().mockRejectedValue(new Error('snapshot quota')),
      });
      mockSandboxCreate.mockReset().mockResolvedValueOnce(sandbox);

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox',
        validBody,
      );
      const response = await POST(request);
      const events = await readSseEvents(response);
      const types = events.map((e) => (typeof e === 'string' ? e : e.type));

      expect(types).toContain('sandbox-ready');
      expect(types).toContain('snapshot-error');
      expect(types).toContain('[DONE]');
    });

    it('returns 500 when request.json throws', async () => {
      const request = new Request('http://localhost:3000/api/webdev/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      });
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});
