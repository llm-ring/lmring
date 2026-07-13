import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockRequest, parseJsonResponse, setupTestEnvironment } from '@/test/helpers';
import { DELETE } from './route';

const { mockAuthInstance, mockDbInstance, mockSandboxGet, mockSandboxStop } = vi.hoisted(() => {
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

  const mockSandboxStop = vi.fn().mockResolvedValue(undefined);
  const mockSandboxGet = vi.fn().mockResolvedValue({ stop: mockSandboxStop });

  return {
    mockAuthInstance: {
      api: {
        getSession: vi.fn().mockResolvedValue(mockSession),
      },
    },
    mockDbInstance: {
      query: {
        webdevResponses: {
          findFirst: vi.fn(),
        },
      },
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    },
    mockSandboxGet,
    mockSandboxStop,
  };
});

vi.mock('@/libs/Auth', () => ({
  auth: mockAuthInstance,
}));

vi.mock('@lmring/database', () => ({
  db: mockDbInstance,
  eq: vi.fn((...args: unknown[]) => args),
}));

vi.mock('@lmring/database/schema', () => ({
  webdevResponses: {
    id: 'id',
    sandboxId: 'sandboxId',
  },
}));

vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    get: mockSandboxGet,
  },
}));

vi.mock('@/libs/webdev-config', () => ({
  getSandboxCredentials: vi
    .fn()
    .mockReturnValue({ token: 'tok', teamId: 'team', projectId: 'proj' }),
}));

vi.mock('@/libs/error-logging', () => ({
  logError: vi.fn(),
}));

setupTestEnvironment();

function resetDbChain() {
  mockDbInstance.update.mockReset().mockReturnValue(mockDbInstance);
  mockDbInstance.set.mockReset().mockReturnValue(mockDbInstance);
  mockDbInstance.where.mockReset().mockResolvedValue(undefined);
  mockDbInstance.query.webdevResponses.findFirst.mockReset();
}

describe('WebDev Sandbox DELETE API', () => {
  beforeEach(() => {
    resetDbChain();
    mockSandboxGet.mockResolvedValue({ stop: mockSandboxStop });
    mockSandboxStop.mockResolvedValue(undefined);
  });

  describe('DELETE /api/webdev/sandbox/[id]', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuthInstance.api.getSession.mockResolvedValueOnce(null);

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/webdev/sandbox/sb-1');
      const response = await DELETE(request, { params: Promise.resolve({ id: 'sb-1' }) });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 400 when sandbox id is empty', async () => {
      const request = createMockRequest('DELETE', 'http://localhost:3000/api/webdev/sandbox/');
      const response = await DELETE(request, { params: Promise.resolve({ id: '   ' }) });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe('Sandbox ID is required');
    });

    it('returns 404 when sandbox is not found', async () => {
      mockDbInstance.query.webdevResponses.findFirst.mockResolvedValueOnce(null);

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/webdev/sandbox/sb-1');
      const response = await DELETE(request, { params: Promise.resolve({ id: 'sb-1' }) });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(404);
      expect(data.error).toBe('Sandbox not found');
    });

    it('returns 404 when sandbox belongs to another user', async () => {
      mockDbInstance.query.webdevResponses.findFirst.mockResolvedValueOnce({
        id: 'resp-1',
        session: { userId: 'other-user' },
      });

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/webdev/sandbox/sb-1');
      const response = await DELETE(request, { params: Promise.resolve({ id: 'sb-1' }) });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(404);
      expect(data.error).toBe('Sandbox not found');
    });

    it('stops sandbox and marks response expired', async () => {
      mockDbInstance.query.webdevResponses.findFirst.mockResolvedValueOnce({
        id: 'resp-1',
        session: { userId: 'test-user-id' },
      });

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/webdev/sandbox/sb-1');
      const response = await DELETE(request, { params: Promise.resolve({ id: 'sb-1' }) });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockSandboxGet).toHaveBeenCalled();
      expect(mockSandboxStop).toHaveBeenCalled();
      expect(mockDbInstance.update).toHaveBeenCalled();
      expect(mockDbInstance.set).toHaveBeenCalledWith({
        status: 'expired',
        sandboxId: null,
        previewUrl: null,
      });
    });

    it('still succeeds when Sandbox.stop throws (non-fatal)', async () => {
      mockDbInstance.query.webdevResponses.findFirst.mockResolvedValueOnce({
        id: 'resp-1',
        session: { userId: 'test-user-id' },
      });
      mockSandboxGet.mockRejectedValueOnce(new Error('already stopped'));

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/webdev/sandbox/sb-1');
      const response = await DELETE(request, { params: Promise.resolve({ id: 'sb-1' }) });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockDbInstance.update).toHaveBeenCalled();
    });

    it('returns 500 on unexpected error', async () => {
      mockDbInstance.query.webdevResponses.findFirst.mockRejectedValueOnce(new Error('db fail'));

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/webdev/sandbox/sb-1');
      const response = await DELETE(request, { params: Promise.resolve({ id: 'sb-1' }) });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});
