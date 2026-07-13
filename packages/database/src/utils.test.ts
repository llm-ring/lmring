import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockFindFirst, mockUpdate, mockSet, mockWhere } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
  mockSet: vi.fn(),
  mockWhere: vi.fn(),
}));

// Create chainable mock
mockUpdate.mockReturnValue({ set: mockSet });
mockSet.mockReturnValue({ where: mockWhere });

vi.mock('./db', () => ({
  db: {
    query: {
      account: {
        findFirst: mockFindFirst,
      },
    },
    update: mockUpdate,
  },
}));

vi.mock('./schema', () => ({
  users: { id: 'users.id' },
  account: {},
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  eq: vi.fn((col, val) => ({ column: col, value: val })),
}));

import { syncUserProviderIdFromAccount } from './utils';

describe('syncUserProviderIdFromAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
  });

  describe('github provider', () => {
    it('returns false when account not found', async () => {
      mockFindFirst.mockResolvedValueOnce(null);

      const result = await syncUserProviderIdFromAccount('user-123', 'github');

      expect(result).toBe(false);
    });

    it('returns false when accountId is empty', async () => {
      mockFindFirst.mockResolvedValueOnce({ accountId: '' });

      const result = await syncUserProviderIdFromAccount('user-123', 'github');

      expect(result).toBe(false);
    });

    it('updates users.githubId and returns true', async () => {
      mockFindFirst.mockResolvedValueOnce({ accountId: 'github-account-123' });

      const result = await syncUserProviderIdFromAccount('user-123', 'github');

      expect(result).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({ githubId: 'github-account-123' });
    });
  });

  describe('google provider', () => {
    it('returns false when account not found', async () => {
      mockFindFirst.mockResolvedValueOnce(null);

      const result = await syncUserProviderIdFromAccount('user-123', 'google');

      expect(result).toBe(false);
    });

    it('updates users.googleId and returns true', async () => {
      mockFindFirst.mockResolvedValueOnce({ accountId: 'google-account-456' });

      const result = await syncUserProviderIdFromAccount('user-123', 'google');

      expect(result).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({ googleId: 'google-account-456' });
    });
  });

  describe('linuxdo provider', () => {
    it('updates users.linuxdoId and returns true', async () => {
      mockFindFirst.mockResolvedValueOnce({ accountId: 'linuxdo-account-789' });

      const result = await syncUserProviderIdFromAccount('user-123', 'linuxdo');

      expect(result).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({ linuxdoId: 'linuxdo-account-789' });
      expect(mockWhere).toHaveBeenCalled();
    });

    it('returns false when account not found', async () => {
      mockFindFirst.mockResolvedValueOnce(null);

      const result = await syncUserProviderIdFromAccount('user-123', 'linuxdo');

      expect(result).toBe(false);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('returns false when accountId is missing', async () => {
      mockFindFirst.mockResolvedValueOnce({ accountId: undefined });

      const result = await syncUserProviderIdFromAccount('user-123', 'linuxdo');

      expect(result).toBe(false);
    });
  });

  it('queries account with findFirst for the given user and provider', async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    await syncUserProviderIdFromAccount('user-xyz', 'github');

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        columns: { accountId: true },
        where: expect.any(Function),
      }),
    );

    // Exercise the where callback used by drizzle relational query API
    const whereFn = mockFindFirst.mock.calls[0][0].where;
    const mockFields = { userId: 'userId', providerId: 'providerId' };
    const mockOps = {
      and: vi.fn((...args: unknown[]) => args),
      eq: vi.fn((a: unknown, b: unknown) => ({ a, b })),
    };
    whereFn(mockFields, mockOps);
    expect(mockOps.eq).toHaveBeenCalledWith('userId', 'user-xyz');
    expect(mockOps.eq).toHaveBeenCalledWith('providerId', 'github');
    expect(mockOps.and).toHaveBeenCalled();
  });
});
