import { describe, expect, it, vi, beforeEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { mockPostgres, mockDrizzle, mockMigrate, mockEnd } = vi.hoisted(() => ({
  mockEnd: vi.fn(),
  mockPostgres: vi.fn(() => ({ end: mockEnd })),
  mockDrizzle: vi.fn(() => ({ db: 'mock-drizzle-instance' })),
  mockMigrate: vi.fn(),
}));

vi.mock('@lmring/env', () => ({
  env: {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
  },
}));

vi.mock('postgres', () => ({
  default: mockPostgres,
}));

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: mockDrizzle,
}));

vi.mock('drizzle-orm/postgres-js/migrator', () => ({
  migrate: mockMigrate,
}));

import { runMigrations } from './migration';

describe('runMigrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMigrate.mockResolvedValue(undefined);
  });

  it('creates postgres client with DATABASE_URL', async () => {
    await runMigrations();

    expect(mockPostgres).toHaveBeenCalledWith(
      'postgresql://user:pass@localhost:5432/testdb',
      expect.any(Object)
    );
  });

  it('uses prepare: false option', async () => {
    await runMigrations();

    expect(mockPostgres).toHaveBeenCalledWith(
      expect.any(String),
      { prepare: false }
    );
  });

  it('calls migrate with correct folder path', async () => {
    await runMigrations();

    expect(mockMigrate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        migrationsFolder: expect.stringContaining('migrations'),
      })
    );
  });

  it('logs success message', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runMigrations();

    expect(consoleSpy).toHaveBeenCalledWith('Database migrations completed successfully');

    consoleSpy.mockRestore();
  });

  it('closes client in finally block', async () => {
    await runMigrations();

    expect(mockEnd).toHaveBeenCalled();
  });

  it('throws and logs error on failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockMigrate.mockRejectedValueOnce(new Error('Migration failed'));

    await expect(runMigrations()).rejects.toThrow('Migration failed');

    expect(consoleSpy).toHaveBeenCalledWith(
      'Database migration failed:',
      'Migration failed'
    );

    consoleSpy.mockRestore();
  });

  it('closes client even on failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockMigrate.mockRejectedValueOnce(new Error('Migration failed'));

    try {
      await runMigrations();
    } catch {
      // expected
    }

    expect(mockEnd).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('logs non-Error failures as-is', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockMigrate.mockRejectedValueOnce('string failure');

    await expect(runMigrations()).rejects.toBe('string failure');

    expect(consoleSpy).toHaveBeenCalledWith(
      'Database migration failed:',
      'string failure',
    );

    consoleSpy.mockRestore();
  });

  it('creates drizzle instance from postgres client', async () => {
    await runMigrations();

    expect(mockDrizzle).toHaveBeenCalledWith({ end: mockEnd });
  });
});

describe('migration CLI entrypoint', () => {
  it('runs migrations when executed as the main module', async () => {
    vi.resetModules();
    mockMigrate.mockResolvedValue(undefined);

    const migrationPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      'migration.ts',
    );
    const originalArgv = process.argv;
    process.argv = [originalArgv[0], migrationPath];

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await import(`${'./migration'}?cli=${Date.now()}`);
      // Allow the fire-and-forget runMigrations() promise to settle
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockMigrate).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Database migrations completed successfully',
      );
    } finally {
      process.argv = originalArgv;
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });

  it('exits with code 1 when CLI migration fails', async () => {
    vi.resetModules();
    mockMigrate.mockRejectedValueOnce(new Error('CLI boom'));

    const migrationPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      'migration.ts',
    );
    const originalArgv = process.argv;
    process.argv = [originalArgv[0], migrationPath];

    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await import(`${'./migration'}?cli-fail=${Date.now()}`);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to run migrations:',
        expect.any(Error),
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      process.argv = originalArgv;
      exitSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });
});
