import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockRequest, parseJsonResponse, setupTestEnvironment } from '@/test/helpers';
import { POST } from './route';

const { mockAuthInstance, mockDbInstance, mockExtendSandboxTimeout } = vi.hoisted(() => {
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
      query: {
        webdevResponses: {
          findFirst: vi.fn(),
        },
      },
    },
    mockExtendSandboxTimeout: vi.fn().mockResolvedValue(true),
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
    sandboxId: 'sandboxId',
  },
}));

vi.mock('@/libs/webdev-resource-manager', () => ({
  extendSandboxTimeout: mockExtendSandboxTimeout,
}));

vi.mock('@/libs/error-logging', () => ({
  logError: vi.fn(),
}));

setupTestEnvironment();

describe('WebDev Sandbox Heartbeat API', () => {
  beforeEach(() => {
    mockDbInstance.query.webdevResponses.findFirst.mockReset();
    mockExtendSandboxTimeout.mockResolvedValue(true);
  });

  describe('POST /api/webdev/sandbox/heartbeat', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuthInstance.api.getSession.mockResolvedValueOnce(null);

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox/heartbeat',
        {
          sandboxId: 'sb-1',
        },
      );
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 400 for invalid body', async () => {
      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox/heartbeat',
        {
          sandboxId: '',
        },
      );
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
    });

    it('returns 404 when sandbox is not found', async () => {
      mockDbInstance.query.webdevResponses.findFirst.mockResolvedValueOnce(null);

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox/heartbeat',
        {
          sandboxId: 'sb-missing',
        },
      );
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(404);
      expect(data.error).toBe('Sandbox not found');
    });

    it('returns 404 when sandbox belongs to another user', async () => {
      mockDbInstance.query.webdevResponses.findFirst.mockResolvedValueOnce({
        id: 'resp-1',
        session: { userId: 'other-user' },
      });

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox/heartbeat',
        {
          sandboxId: 'sb-1',
        },
      );
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(404);
      expect(data.error).toBe('Sandbox not found');
    });

    it('extends timeout when ownership is valid', async () => {
      mockDbInstance.query.webdevResponses.findFirst.mockResolvedValueOnce({
        id: 'resp-1',
        session: { userId: 'test-user-id' },
      });
      mockExtendSandboxTimeout.mockResolvedValueOnce(true);

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox/heartbeat',
        {
          sandboxId: 'sb-1',
        },
      );
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(200);
      expect(data.extended).toBe(true);
      expect(mockExtendSandboxTimeout).toHaveBeenCalledWith('sb-1');
    });

    it('returns extended=false when debounced', async () => {
      mockDbInstance.query.webdevResponses.findFirst.mockResolvedValueOnce({
        id: 'resp-1',
        session: { userId: 'test-user-id' },
      });
      mockExtendSandboxTimeout.mockResolvedValueOnce(false);

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox/heartbeat',
        {
          sandboxId: 'sb-1',
        },
      );
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(200);
      expect(data.extended).toBe(false);
    });

    it('returns 500 on unexpected error', async () => {
      mockDbInstance.query.webdevResponses.findFirst.mockRejectedValueOnce(new Error('db down'));

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox/heartbeat',
        {
          sandboxId: 'sb-1',
        },
      );
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});
