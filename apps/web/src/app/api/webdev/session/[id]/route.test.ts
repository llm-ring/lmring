import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockRequest, parseJsonResponse, setupTestEnvironment } from '@/test/helpers';
import { GET } from './route';

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

  const mockDbInstance = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
  };

  return {
    mockAuthInstance: {
      api: {
        getSession: vi.fn().mockResolvedValue(mockSession),
      },
    },
    mockDbInstance,
  };
});

vi.mock('@/libs/Auth', () => ({
  auth: mockAuthInstance,
}));

vi.mock('@lmring/database', () => ({
  db: mockDbInstance,
  eq: vi.fn(),
  and: vi.fn(),
  asc: vi.fn(),
  desc: vi.fn(),
}));

vi.mock('@lmring/database/schema', () => ({
  webdevSessions: {
    id: 'id',
    userId: 'userId',
  },
  webdevResponses: {
    sessionId: 'sessionId',
    displayPosition: 'displayPosition',
  },
  webdevIterations: {
    sessionId: 'sessionId',
    version: 'version',
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
  mockDbInstance.orderBy.mockReset().mockReturnValue(mockDbInstance);
}

describe('WebDev Session by ID API', () => {
  const sessionId = 'aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa';
  const mockWebdevSession = {
    id: sessionId,
    userId: 'test-user-id',
    prompt: 'Build a todo app',
    status: 'ready',
  };

  beforeEach(() => {
    resetDbChain();
  });

  describe('GET /api/webdev/session/[id]', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuthInstance.api.getSession.mockResolvedValueOnce(null);

      const request = createMockRequest(
        'GET',
        `http://localhost:3000/api/webdev/session/${sessionId}`,
      );
      const response = await GET(request, { params: Promise.resolve({ id: sessionId }) });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 404 when session not found', async () => {
      mockDbInstance.limit.mockResolvedValueOnce([]);

      const request = createMockRequest(
        'GET',
        `http://localhost:3000/api/webdev/session/${sessionId}`,
      );
      const response = await GET(request, { params: Promise.resolve({ id: sessionId }) });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(404);
      expect(data.error).toBe('Session not found');
    });

    it('returns session with responses and iterations', async () => {
      const responses = [{ id: 'r1', modelId: 'gpt-4', displayPosition: 0 }];
      const iterations = [{ id: 'i1', version: 1, prompt: 'Build a todo app' }];

      // First chain: select session → limit → [session]
      mockDbInstance.limit.mockResolvedValueOnce([mockWebdevSession]);
      // Parallel: responses orderBy and iterations orderBy
      mockDbInstance.orderBy.mockResolvedValueOnce(responses).mockResolvedValueOnce(iterations);

      const request = createMockRequest(
        'GET',
        `http://localhost:3000/api/webdev/session/${sessionId}`,
      );
      const response = await GET(request, { params: Promise.resolve({ id: sessionId }) });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(200);
      expect(data.session).toEqual(mockWebdevSession);
      expect(data.responses).toEqual(responses);
      expect(data.iterations).toEqual(iterations);
    });

    it('returns 500 on unexpected error', async () => {
      mockDbInstance.limit.mockRejectedValueOnce(new Error('db fail'));

      const request = createMockRequest(
        'GET',
        `http://localhost:3000/api/webdev/session/${sessionId}`,
      );
      const response = await GET(request, { params: Promise.resolve({ id: sessionId }) });
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});
