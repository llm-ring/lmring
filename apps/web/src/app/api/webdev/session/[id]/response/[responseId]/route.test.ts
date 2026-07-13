import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockRequest, parseJsonResponse, setupTestEnvironment } from '@/test/helpers';
import { PATCH } from './route';

const { mockAuthInstance, mockDbInstance } = vi.hoisted(() => {
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
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    },
  };
});

vi.mock('@/libs/Auth', () => ({
  auth: mockAuthInstance,
}));

vi.mock('@lmring/database', () => ({
  db: mockDbInstance,
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock('@lmring/database/schema', () => ({
  webdevSessions: {
    id: 'id',
    userId: 'userId',
  },
  webdevResponses: {
    id: 'id',
    sessionId: 'sessionId',
    content: 'content',
  },
}));

vi.mock('@/libs/error-logging', () => ({
  logError: vi.fn(),
}));

setupTestEnvironment();

function resetDbChain() {
  mockDbInstance.select.mockReset().mockReturnValue(mockDbInstance);
  mockDbInstance.from.mockReset().mockReturnValue(mockDbInstance);
  mockDbInstance.where.mockReset().mockReturnValue(mockDbInstance);
  mockDbInstance.limit.mockReset().mockReturnValue(mockDbInstance);
  mockDbInstance.update.mockReset().mockReturnValue(mockDbInstance);
  mockDbInstance.set.mockReset().mockReturnValue(mockDbInstance);
}

describe('WebDev Response PATCH API', () => {
  const sessionId = 'aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa';
  const responseId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

  beforeEach(() => {
    resetDbChain();
  });

  describe('PATCH /api/webdev/session/[id]/response/[responseId]', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuthInstance.api.getSession.mockResolvedValueOnce(null);

      const request = createMockRequest(
        'PATCH',
        `http://localhost:3000/api/webdev/session/${sessionId}/response/${responseId}`,
        { content: 'hello' },
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ id: sessionId, responseId }),
      });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 404 when session not found', async () => {
      mockDbInstance.limit.mockResolvedValueOnce([]);

      const request = createMockRequest(
        'PATCH',
        `http://localhost:3000/api/webdev/session/${sessionId}/response/${responseId}`,
        { content: 'hello' },
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ id: sessionId, responseId }),
      });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(404);
      expect(data.error).toBe('Session not found');
    });

    it('returns 400 when content is missing', async () => {
      mockDbInstance.limit.mockResolvedValueOnce([{ id: sessionId }]);

      const request = createMockRequest(
        'PATCH',
        `http://localhost:3000/api/webdev/session/${sessionId}/response/${responseId}`,
        {},
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ id: sessionId, responseId }),
      });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe('content is required');
    });

    it('saves content and returns ok', async () => {
      mockDbInstance.limit.mockResolvedValueOnce([{ id: sessionId }]);
      // update().set().where() — where is the terminal call on the update chain
      mockDbInstance.where
        .mockReturnValueOnce(mockDbInstance) // select session chain
        .mockResolvedValueOnce(undefined); // update where

      const request = createMockRequest(
        'PATCH',
        `http://localhost:3000/api/webdev/session/${sessionId}/response/${responseId}`,
        { content: 'generated code' },
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ id: sessionId, responseId }),
      });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(mockDbInstance.update).toHaveBeenCalled();
      expect(mockDbInstance.set).toHaveBeenCalledWith({ content: 'generated code' });
    });

    it('returns 500 on unexpected error', async () => {
      mockDbInstance.limit.mockRejectedValueOnce(new Error('db fail'));

      const request = createMockRequest(
        'PATCH',
        `http://localhost:3000/api/webdev/session/${sessionId}/response/${responseId}`,
        { content: 'hello' },
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ id: sessionId, responseId }),
      });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});
