import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSentryInit = vi.fn();
const mockCaptureRequestError = vi.fn();
const mockConsoleLoggingIntegration = vi.fn(() => ({}));

vi.mock('@sentry/nextjs', () => ({
  init: mockSentryInit,
  captureRequestError: mockCaptureRequestError,
  consoleLoggingIntegration: mockConsoleLoggingIntegration,
}));

describe('instrumentation', () => {
  const originalProcessEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    mockSentryInit.mockClear();
    mockCaptureRequestError.mockClear();
    mockConsoleLoggingIntegration.mockClear();
    process.env = { ...originalProcessEnv };
  });

  afterEach(() => {
    process.env = originalProcessEnv;
  });

  describe('register', () => {
    describe('DATABASE_URL check', () => {
      it('should log error when DATABASE_URL is empty', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
        process.env.NEXT_RUNTIME = 'nodejs';

        vi.doMock('@lmring/env', () => ({
          env: {
            DATABASE_URL: '',
            NEXT_PUBLIC_SENTRY_DISABLED: 'true',
          },
        }));

        const { register } = await import('./instrumentation');
        await register();

        expect(errorSpy).toHaveBeenCalledWith(
          'DATABASE_URL not configured, database features may be unavailable',
        );
        errorSpy.mockRestore();
        infoSpy.mockRestore();
      });

      it('should log error when DATABASE_URL is undefined', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
        process.env.NEXT_RUNTIME = 'nodejs';

        vi.doMock('@lmring/env', () => ({
          env: {
            NEXT_PUBLIC_SENTRY_DISABLED: 'true',
          },
        }));

        const { register } = await import('./instrumentation');
        await register();

        expect(errorSpy).toHaveBeenCalledWith(
          'DATABASE_URL not configured, database features may be unavailable',
        );
        errorSpy.mockRestore();
        infoSpy.mockRestore();
      });

      it('should not log error when DATABASE_URL is set', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
        process.env.NEXT_RUNTIME = 'nodejs';

        vi.doMock('@lmring/env', () => ({
          env: {
            DATABASE_URL: 'postgresql://localhost:5432/db',
            NEXT_PUBLIC_SENTRY_DISABLED: 'true',
          },
        }));

        const { register } = await import('./instrumentation');
        await register();

        expect(errorSpy).not.toHaveBeenCalled();
        errorSpy.mockRestore();
        infoSpy.mockRestore();
      });
    });

    describe('Sentry initialization', () => {
      it('should skip Sentry.init when SENTRY_DISABLED is true', async () => {
        const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
        process.env.NEXT_RUNTIME = 'nodejs';

        vi.doMock('@lmring/env', () => ({
          env: {
            DATABASE_URL: 'postgresql://localhost:5432/db',
            NEXT_PUBLIC_SENTRY_DISABLED: 'true',
          },
        }));

        const { register } = await import('./instrumentation');
        await register();

        expect(mockSentryInit).not.toHaveBeenCalled();
        infoSpy.mockRestore();
      });

      it('should skip Sentry.init when SENTRY_DISABLED is TRUE (case insensitive)', async () => {
        const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
        process.env.NEXT_RUNTIME = 'nodejs';

        vi.doMock('@lmring/env', () => ({
          env: {
            DATABASE_URL: 'postgresql://localhost:5432/db',
            NEXT_PUBLIC_SENTRY_DISABLED: 'TRUE',
          },
        }));

        const { register } = await import('./instrumentation');
        await register();

        expect(mockSentryInit).not.toHaveBeenCalled();
        infoSpy.mockRestore();
      });

      it('should initialize Sentry for nodejs runtime', async () => {
        const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
        process.env.NEXT_RUNTIME = 'nodejs';

        vi.doMock('@lmring/env', () => ({
          env: {
            DATABASE_URL: 'postgresql://localhost:5432/db',
            NEXT_PUBLIC_SENTRY_DISABLED: 'false',
            NEXT_PUBLIC_SENTRY_DSN: 'https://sentry.example.com/123',
            NODE_ENV: 'production',
          },
        }));

        const { register } = await import('./instrumentation');
        await register();

        expect(mockSentryInit).toHaveBeenCalledTimes(1);
        expect(mockSentryInit).toHaveBeenCalledWith(
          expect.objectContaining({
            dsn: 'https://sentry.example.com/123',
            tracesSampleRate: 1,
            debug: false,
          }),
        );
        infoSpy.mockRestore();
      });

      it('should initialize Sentry for edge runtime', async () => {
        const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
        process.env.NEXT_RUNTIME = 'edge';

        vi.doMock('@lmring/env', () => ({
          env: {
            DATABASE_URL: 'postgresql://localhost:5432/db',
            NEXT_PUBLIC_SENTRY_DISABLED: 'false',
            NEXT_PUBLIC_SENTRY_DSN: 'https://sentry.example.com/456',
            NODE_ENV: 'production',
          },
        }));

        const { register } = await import('./instrumentation');
        await register();

        expect(mockSentryInit).toHaveBeenCalledTimes(1);
        infoSpy.mockRestore();
      });

      it('should enable spotlight in development mode', async () => {
        const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
        process.env.NEXT_RUNTIME = 'nodejs';

        vi.doMock('@lmring/env', () => ({
          env: {
            DATABASE_URL: 'postgresql://localhost:5432/db',
            NEXT_PUBLIC_SENTRY_DISABLED: 'false',
            NEXT_PUBLIC_SENTRY_DSN: 'https://sentry.example.com/123',
            NODE_ENV: 'development',
          },
        }));

        const { register } = await import('./instrumentation');
        await register();

        expect(mockSentryInit).toHaveBeenCalledWith(
          expect.objectContaining({
            spotlight: true,
          }),
        );
        infoSpy.mockRestore();
      });
    });
  });

  describe('onRequestError export', () => {
    it('should export Sentry.captureRequestError', async () => {
      vi.doMock('@lmring/env', () => ({
        env: {
          DATABASE_URL: 'postgresql://localhost:5432/db',
          NEXT_PUBLIC_SENTRY_DISABLED: 'true',
        },
      }));

      const { onRequestError } = await import('./instrumentation');

      expect(onRequestError).toBe(mockCaptureRequestError);
    });
  });
});
