import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockPostgres, mockDrizzle, mockEnv } = vi.hoisted(() => {
  const mockDbClient = { query: vi.fn() };
  return {
    mockPostgres: vi.fn(() => mockDbClient),
    mockDrizzle: vi.fn(() => ({ db: 'mock-drizzle-instance' })),
    mockEnv: {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
    },
  };
});

vi.mock('@lmring/env', () => ({
  env: mockEnv,
}));

vi.mock('postgres', () => ({
  default: mockPostgres,
}));

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: mockDrizzle,
}));

vi.mock('./schema', () => ({
  users: {},
  account: {},
}));

import { createDbConnection } from './connection';

describe('createDbConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
  });

  it('creates drizzle connection', () => {
    const result = createDbConnection();
    expect(result).toEqual({ db: 'mock-drizzle-instance' });
    expect(mockDrizzle).toHaveBeenCalled();
  });

  it('adds search_path=public to URL without options', () => {
    createDbConnection();

    const calls = mockPostgres.mock.calls as unknown[][];
    expect(calls.length).toBeGreaterThan(0);
    const calledUrl = calls[0]?.[0] as string;
    expect(calledUrl).toContain('options=-c+search_path%3Dpublic');
  });

  it('preserves existing options query param', () => {
    mockEnv.DATABASE_URL =
      'postgresql://user:pass@localhost:5432/testdb?options=-c%20search_path%3Dcustom';

    createDbConnection();

    const calledUrl = (mockPostgres.mock.calls as unknown[][])[0]?.[0] as string;
    // Should not append another options param
    expect(calledUrl).toContain('options=');
    expect(calledUrl).not.toContain('search_path%3Dpublic');
    expect(calledUrl).toContain('search_path');
  });

  it('uses prepare: false', () => {
    createDbConnection();

    const calls = mockPostgres.mock.calls as unknown[][];
    expect(calls.length).toBeGreaterThan(0);
    const options = calls[0]?.[1] as { prepare: boolean };
    expect(options.prepare).toBe(false);
  });
});

describe('createDbConnection error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
  });

  it('throws "Database connection failed" on error', () => {
    mockPostgres.mockImplementationOnce(() => {
      throw new Error('Connection refused');
    });

    expect(() => createDbConnection()).toThrow('Database connection failed');
  });

  it('logs error message on failure', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockPostgres.mockImplementationOnce(() => {
      throw new Error('Connection refused');
    });

    try {
      createDbConnection();
    } catch {
      // expected
    }

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to create database connection:',
      'Connection refused'
    );

    consoleSpy.mockRestore();
  });

  it('logs non-Error failures as-is', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockPostgres.mockImplementationOnce(() => {
      throw 'raw failure';
    });

    expect(() => createDbConnection()).toThrow('Database connection failed');
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to create database connection:',
      'raw failure',
    );

    consoleSpy.mockRestore();
  });
});
