import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockRequest, parseJsonResponse, setupTestEnvironment } from '@/test/helpers';
import { POST } from './route';

const { mockAuthInstance, mockCleanupUserSandboxes } = vi.hoisted(() => {
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
    mockCleanupUserSandboxes: vi.fn().mockResolvedValue(2),
  };
});

vi.mock('@/libs/Auth', () => ({
  auth: mockAuthInstance,
}));

vi.mock('@/libs/webdev-resource-manager', () => ({
  cleanupUserSandboxes: mockCleanupUserSandboxes,
}));

vi.mock('@/libs/error-logging', () => ({
  logError: vi.fn(),
}));

setupTestEnvironment();

describe('WebDev Sandbox Cleanup API', () => {
  beforeEach(() => {
    mockCleanupUserSandboxes.mockResolvedValue(2);
  });

  describe('POST /api/webdev/sandbox/cleanup', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuthInstance.api.getSession.mockResolvedValueOnce(null);

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox/cleanup',
        {
          sandboxIds: ['sb-1'],
        },
      );
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 400 when sandboxIds is empty', async () => {
      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox/cleanup',
        {
          sandboxIds: [],
        },
      );
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
    });

    it('returns 400 when sandboxIds exceeds max', async () => {
      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox/cleanup',
        {
          sandboxIds: Array.from({ length: 11 }, (_, i) => `sb-${i}`),
        },
      );
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
    });

    it('cleans up sandboxes for the authenticated user', async () => {
      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox/cleanup',
        {
          sandboxIds: ['sb-1', 'sb-2'],
        },
      );
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(200);
      expect(data.cleaned).toBe(2);
      expect(mockCleanupUserSandboxes).toHaveBeenCalledWith('test-user-id');
    });

    it('returns 500 on unexpected error', async () => {
      mockCleanupUserSandboxes.mockRejectedValueOnce(new Error('cleanup failed'));

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/webdev/sandbox/cleanup',
        {
          sandboxIds: ['sb-1'],
        },
      );
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});
