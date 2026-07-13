import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockRequest, parseJsonResponse, setupTestEnvironment } from '@/test/helpers';
import { GET, PATCH, POST } from './route';

const { mockAuthInstance, mockDbInstance, mockCleanupSessionSandboxes } = vi.hoisted(() => {
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

  const mockDbInstance: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    transaction: vi.fn(),
    query: {
      webdevSessions: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
  };

  return {
    mockAuthInstance: {
      api: {
        getSession: vi.fn().mockResolvedValue(mockSession),
      },
    },
    mockDbInstance,
    mockCleanupSessionSandboxes: vi.fn().mockResolvedValue(0),
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
    status: 'status',
    prompt: 'prompt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    conversationId: 'conversationId',
  },
  webdevResponses: {
    id: 'id',
    sessionId: 'sessionId',
    modelId: 'modelId',
    keyId: 'keyId',
    status: 'status',
    displayPosition: 'displayPosition',
    iterationId: 'iterationId',
  },
  webdevIterations: {
    id: 'id',
    sessionId: 'sessionId',
    prompt: 'prompt',
    version: 'version',
  },
}));

vi.mock('@/libs/webdev-resource-manager', () => ({
  cleanupSessionSandboxes: mockCleanupSessionSandboxes,
}));

vi.mock('@/libs/error-logging', () => ({
  logError: vi.fn(),
}));

setupTestEnvironment();

const validUUID = '550e8400-e29b-41d4-a716-446655440000';
const sessionId = 'aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa';

function resetDbChain() {
  (mockDbInstance.select as ReturnType<typeof vi.fn>).mockReset().mockReturnValue(mockDbInstance);
  (mockDbInstance.from as ReturnType<typeof vi.fn>).mockReset().mockReturnValue(mockDbInstance);
  (mockDbInstance.where as ReturnType<typeof vi.fn>).mockReset().mockReturnValue(mockDbInstance);
  (mockDbInstance.limit as ReturnType<typeof vi.fn>).mockReset().mockReturnValue(mockDbInstance);
  (mockDbInstance.orderBy as ReturnType<typeof vi.fn>).mockReset().mockReturnValue(mockDbInstance);
  (mockDbInstance.insert as ReturnType<typeof vi.fn>).mockReset().mockReturnValue(mockDbInstance);
  (mockDbInstance.values as ReturnType<typeof vi.fn>).mockReset().mockReturnValue(mockDbInstance);
  (mockDbInstance.returning as ReturnType<typeof vi.fn>).mockReset().mockResolvedValue([]);
  (mockDbInstance.update as ReturnType<typeof vi.fn>).mockReset().mockReturnValue(mockDbInstance);
  (mockDbInstance.set as ReturnType<typeof vi.fn>).mockReset().mockReturnValue(mockDbInstance);
  (mockDbInstance.transaction as ReturnType<typeof vi.fn>).mockReset();
  (
    mockDbInstance.query as { webdevSessions: { findMany: ReturnType<typeof vi.fn> } }
  ).webdevSessions.findMany
    .mockReset()
    .mockResolvedValue([]);
  mockCleanupSessionSandboxes.mockReset().mockResolvedValue(0);
}

describe('WebDev Session API', () => {
  beforeEach(() => {
    resetDbChain();
  });

  describe('POST /api/webdev/session', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuthInstance.api.getSession.mockResolvedValueOnce(null);

      const request = createMockRequest('POST', 'http://localhost:3000/api/webdev/session', {
        prompt: 'Build a todo app',
        models: [{ modelId: 'gpt-4', keyId: validUUID }],
      });
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 400 when validation fails', async () => {
      const request = createMockRequest('POST', 'http://localhost:3000/api/webdev/session', {
        prompt: '',
        models: [],
      });
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });

    it('creates session, responses, and first iteration', async () => {
      const newSession = { id: sessionId, userId: 'test-user-id', prompt: 'Build a todo app' };
      const newResponses = [
        { id: 'r1', modelId: 'gpt-4', displayPosition: 0 },
        { id: 'r2', modelId: 'claude', displayPosition: 1 },
      ];
      const firstIteration = { id: 'i1', version: 1, prompt: 'Build a todo app' };

      (mockDbInstance.returning as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([newSession])
        .mockResolvedValueOnce(newResponses)
        .mockResolvedValueOnce([firstIteration]);

      const request = createMockRequest('POST', 'http://localhost:3000/api/webdev/session', {
        prompt: 'Build a todo app',
        models: [
          { modelId: 'gpt-4', keyId: validUUID },
          { modelId: 'claude', keyId: validUUID },
        ],
      });
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(201);
      expect(data.sessionId).toBe(sessionId);
      expect(data.iteration).toEqual({ id: 'i1', version: 1, prompt: 'Build a todo app' });
      expect(data.responses).toHaveLength(2);
      expect(mockDbInstance.insert).toHaveBeenCalledTimes(3);
    });

    it('cleans up stale generating sessions before creating', async () => {
      (
        mockDbInstance.query as { webdevSessions: { findMany: ReturnType<typeof vi.fn> } }
      ).webdevSessions.findMany.mockResolvedValueOnce([{ id: 'stale-1' }]);

      const newSession = { id: sessionId, userId: 'test-user-id', prompt: 'App' };
      (mockDbInstance.returning as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([newSession])
        .mockResolvedValueOnce([{ id: 'r1', modelId: 'gpt-4', displayPosition: 0 }])
        .mockResolvedValueOnce([{ id: 'i1', version: 1, prompt: 'App' }]);

      const request = createMockRequest('POST', 'http://localhost:3000/api/webdev/session', {
        prompt: 'App',
        models: [{ modelId: 'gpt-4', keyId: validUUID }],
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(mockCleanupSessionSandboxes).toHaveBeenCalledWith('stale-1');
      expect(mockDbInstance.update).toHaveBeenCalled();
    });

    it('returns 500 when session insert returns empty', async () => {
      (mockDbInstance.returning as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      const request = createMockRequest('POST', 'http://localhost:3000/api/webdev/session', {
        prompt: 'App',
        models: [{ modelId: 'gpt-4', keyId: validUUID }],
      });
      const response = await POST(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('GET /api/webdev/session', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuthInstance.api.getSession.mockResolvedValueOnce(null);

      const request = createMockRequest('GET', 'http://localhost:3000/api/webdev/session');
      const response = await GET(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('lists user sessions', async () => {
      const sessions = [{ id: sessionId, prompt: 'App' }];
      (mockDbInstance.orderBy as ReturnType<typeof vi.fn>).mockResolvedValueOnce(sessions);

      const request = createMockRequest('GET', 'http://localhost:3000/api/webdev/session');
      const response = await GET(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(200);
      expect(data.sessions).toEqual(sessions);
    });

    it('returns 500 on error', async () => {
      (mockDbInstance.orderBy as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('db'));

      const request = createMockRequest('GET', 'http://localhost:3000/api/webdev/session');
      const response = await GET(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('PATCH /api/webdev/session', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuthInstance.api.getSession.mockResolvedValueOnce(null);

      const request = createMockRequest('PATCH', 'http://localhost:3000/api/webdev/session', {
        sessionId,
        prompt: 'Improve UI',
      });
      const response = await PATCH(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 400 when validation fails', async () => {
      const request = createMockRequest('PATCH', 'http://localhost:3000/api/webdev/session', {
        sessionId: 'not-uuid',
        prompt: '',
      });
      const response = await PATCH(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });

    it('returns 404 when session not found', async () => {
      (mockDbInstance.limit as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      const request = createMockRequest('PATCH', 'http://localhost:3000/api/webdev/session', {
        sessionId,
        prompt: 'Improve UI',
      });
      const response = await PATCH(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(404);
      expect(data.error).toBe('Session not found');
    });

    it('creates follow-up iteration and responses', async () => {
      (mockDbInstance.limit as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { id: sessionId, userId: 'test-user-id' },
      ]);

      const newIteration = { id: 'i2', version: 2, prompt: 'Improve UI' };
      const newResponses = [{ id: 'r3', modelId: 'gpt-4', displayPosition: 0 }];

      (mockDbInstance.transaction as ReturnType<typeof vi.fn>).mockImplementationOnce(
        async (fn: (tx: Record<string, ReturnType<typeof vi.fn>>) => Promise<unknown>) => {
          let selectCount = 0;
          const tx: Record<string, ReturnType<typeof vi.fn>> = {
            select: vi.fn().mockImplementation(() => {
              selectCount += 1;
              return tx;
            }),
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockImplementation(() => {
              // 1st select: latest iteration → orderBy().limit()
              // 2nd select: original responses → orderBy() is terminal
              if (selectCount === 1) {
                return {
                  limit: vi.fn().mockResolvedValue([{ version: 1 }]),
                };
              }
              return Promise.resolve([
                { modelId: 'gpt-4', keyId: validUUID, displayPosition: 0 },
                { modelId: 'gpt-4', keyId: validUUID, displayPosition: 0 },
              ]);
            }),
            limit: vi.fn().mockResolvedValue([{ version: 1 }]),
            insert: vi.fn().mockReturnThis(),
            values: vi.fn().mockReturnThis(),
            returning: vi
              .fn()
              .mockResolvedValueOnce([newIteration])
              .mockResolvedValueOnce(newResponses),
            update: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
          };
          // update().set().where() — where is terminal for update
          tx.where = vi.fn().mockImplementation(() => {
            // During select chains, where returns tx for further chaining.
            // After update/set, where resolves.
            return tx;
          });
          // Make update set chain resolve at where when coming from update
          let inUpdate = false;
          tx.update = vi.fn().mockImplementation(() => {
            inUpdate = true;
            return tx;
          });
          tx.set = vi.fn().mockReturnValue(tx);
          tx.where = vi.fn().mockImplementation(() => {
            if (inUpdate) {
              inUpdate = false;
              return Promise.resolve(undefined);
            }
            return tx;
          });

          return fn(tx);
        },
      );

      const request = createMockRequest('PATCH', 'http://localhost:3000/api/webdev/session', {
        sessionId,
        prompt: 'Improve UI',
      });
      const response = await PATCH(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(200);
      expect(data.iteration).toEqual({
        id: 'i2',
        version: 2,
        prompt: 'Improve UI',
      });
      expect(data.responses).toEqual([{ id: 'r3', modelId: 'gpt-4', displayPosition: 0 }]);
    });

    it('returns 500 on transaction failure', async () => {
      (mockDbInstance.limit as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { id: sessionId, userId: 'test-user-id' },
      ]);
      (mockDbInstance.transaction as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('tx fail'),
      );

      const request = createMockRequest('PATCH', 'http://localhost:3000/api/webdev/session', {
        sessionId,
        prompt: 'Improve UI',
      });
      const response = await PATCH(request);
      const data = await parseJsonResponse(response);

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});
