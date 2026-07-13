import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbInstance, mockSandboxGet, mockGetSandboxCredentials } = vi.hoisted(() => {
  return {
    mockDbInstance: {
      query: {
        webdevSessions: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        webdevResponses: {
          findMany: vi.fn(),
        },
      },
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    },
    mockSandboxGet: vi.fn(),
    mockGetSandboxCredentials: vi.fn().mockReturnValue({
      token: 'tok',
      teamId: 'team',
      projectId: 'proj',
    }),
  };
});

vi.mock('@lmring/database', () => ({
  db: mockDbInstance,
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((...args: unknown[]) => args),
  gt: vi.fn((...args: unknown[]) => args),
  lt: vi.fn((...args: unknown[]) => args),
  isNotNull: vi.fn((...args: unknown[]) => args),
}));

vi.mock('@lmring/database/schema', () => ({
  webdevSessions: {
    userId: 'userId',
    status: 'status',
    id: 'id',
    createdAt: 'createdAt',
  },
  webdevResponses: {
    sandboxId: 'sandboxId',
    createdAt: 'createdAt',
    sessionId: 'sessionId',
    expiresAt: 'expiresAt',
    id: 'id',
  },
}));

vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    get: mockSandboxGet,
  },
}));

vi.mock('@/libs/webdev-config', () => ({
  getSandboxCredentials: mockGetSandboxCredentials,
}));

vi.mock('@/libs/error-logging', () => ({
  logError: vi.fn(),
}));

import {
  canCreateSession,
  checkSandboxRateLimit,
  cleanupSandbox,
  cleanupSessionSandboxes,
  cleanupStaleSandboxes,
  cleanupUserSandboxes,
  extendSandboxTimeout,
  getActiveSession,
} from './webdev-resource-manager';

describe('webdev-resource-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbInstance.update.mockReturnValue(mockDbInstance);
    mockDbInstance.set.mockReturnValue(mockDbInstance);
    mockDbInstance.where.mockResolvedValue(undefined);
  });

  describe('getActiveSession', () => {
    it('returns session id when active session exists', async () => {
      mockDbInstance.query.webdevSessions.findFirst.mockResolvedValueOnce({ id: 's1' });
      await expect(getActiveSession('u1')).resolves.toBe('s1');
    });

    it('returns null when no active session', async () => {
      mockDbInstance.query.webdevSessions.findFirst.mockResolvedValueOnce(undefined);
      await expect(getActiveSession('u1')).resolves.toBeNull();
    });
  });

  describe('canCreateSession', () => {
    it('allows when under limit', async () => {
      mockDbInstance.query.webdevSessions.findMany.mockResolvedValueOnce([]);
      await expect(canCreateSession('u1')).resolves.toEqual({ allowed: true });
    });

    it('denies when active session exists', async () => {
      mockDbInstance.query.webdevSessions.findMany.mockResolvedValueOnce([{ id: 'existing' }]);
      await expect(canCreateSession('u1')).resolves.toEqual({
        allowed: false,
        existingSessionId: 'existing',
      });
    });
  });

  describe('checkSandboxRateLimit', () => {
    it('counts only current user sandboxes', async () => {
      mockDbInstance.query.webdevResponses.findMany.mockResolvedValueOnce([
        { id: '1', session: { userId: 'u1' } },
        { id: '2', session: { userId: 'u1' } },
        { id: '3', session: { userId: 'other' } },
      ]);

      const result = await checkSandboxRateLimit('u1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(48);
      expect(result.limit).toBe(50);
    });

    it('disallows when user hits daily limit', async () => {
      mockDbInstance.query.webdevResponses.findMany.mockResolvedValueOnce(
        Array.from({ length: 50 }, (_, i) => ({
          id: String(i),
          session: { userId: 'u1' },
        })),
      );

      const result = await checkSandboxRateLimit('u1');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('extendSandboxTimeout', () => {
    it('extends timeout and updates DB', async () => {
      const extendTimeout = vi.fn().mockResolvedValue(undefined);
      mockSandboxGet.mockResolvedValueOnce({
        extendTimeout,
        timeout: 10 * 60 * 1000,
      });

      const result = await extendSandboxTimeout(`sb-extend-${Date.now()}`);
      expect(result).toBe(true);
      expect(extendTimeout).toHaveBeenCalledWith(10 * 60 * 1000);
      expect(mockDbInstance.update).toHaveBeenCalled();
    });

    it('debounces rapid calls for the same sandbox', async () => {
      const sandboxId = `sb-debounce-${Date.now()}`;
      const extendTimeout = vi.fn().mockResolvedValue(undefined);
      mockSandboxGet.mockResolvedValue({
        extendTimeout,
        timeout: 10 * 60 * 1000,
      });

      await expect(extendSandboxTimeout(sandboxId)).resolves.toBe(true);
      await expect(extendSandboxTimeout(sandboxId)).resolves.toBe(false);
      expect(extendTimeout).toHaveBeenCalledTimes(1);
    });

    it('returns false and clears debounce when extension fails', async () => {
      const sandboxId = `sb-fail-${Date.now()}`;
      mockSandboxGet.mockRejectedValueOnce(new Error('gone'));

      await expect(extendSandboxTimeout(sandboxId)).resolves.toBe(false);
    });
  });

  describe('cleanupSandbox', () => {
    it('stops sandbox and clears DB fields', async () => {
      const stop = vi.fn().mockResolvedValue(undefined);
      mockSandboxGet.mockResolvedValueOnce({ stop });

      await cleanupSandbox('sb-1');

      expect(stop).toHaveBeenCalled();
      expect(mockDbInstance.set).toHaveBeenCalledWith({
        status: 'expired',
        sandboxId: null,
        previewUrl: null,
      });
    });

    it('still updates DB if Sandbox.get fails', async () => {
      mockSandboxGet.mockRejectedValueOnce(new Error('already gone'));

      await cleanupSandbox('sb-2');

      expect(mockDbInstance.update).toHaveBeenCalled();
    });
  });

  describe('cleanupSessionSandboxes', () => {
    it('cleans all sandboxes for a session', async () => {
      mockDbInstance.query.webdevResponses.findMany.mockResolvedValueOnce([
        { sandboxId: 'a' },
        { sandboxId: 'b' },
        { sandboxId: null },
      ]);
      mockSandboxGet.mockResolvedValue({ stop: vi.fn().mockResolvedValue(undefined) });

      const cleaned = await cleanupSessionSandboxes('session-1');
      expect(cleaned).toBe(2);
    });
  });

  describe('cleanupUserSandboxes', () => {
    it('filters to the given user', async () => {
      mockDbInstance.query.webdevResponses.findMany.mockResolvedValueOnce([
        { sandboxId: 'a', session: { userId: 'u1' } },
        { sandboxId: 'b', session: { userId: 'u2' } },
      ]);
      mockSandboxGet.mockResolvedValue({ stop: vi.fn().mockResolvedValue(undefined) });

      const cleaned = await cleanupUserSandboxes('u1');
      expect(cleaned).toBe(1);
    });
  });

  describe('cleanupStaleSandboxes', () => {
    it('returns 0 when nothing is stale', async () => {
      mockDbInstance.query.webdevResponses.findMany.mockResolvedValueOnce([]);
      await expect(cleanupStaleSandboxes()).resolves.toBe(0);
    });

    it('cleans stale sandboxes', async () => {
      mockDbInstance.query.webdevResponses.findMany.mockResolvedValueOnce([
        { id: '1', sandboxId: 'stale-1' },
        { id: '2', sandboxId: 'stale-2' },
      ]);
      mockSandboxGet.mockResolvedValue({ stop: vi.fn().mockResolvedValue(undefined) });

      const cleaned = await cleanupStaleSandboxes();
      expect(cleaned).toBe(2);
    });
  });
});
