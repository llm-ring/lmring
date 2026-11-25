import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSentryInit = vi.fn();
const mockCaptureRouterTransitionStart = vi.fn();
const mockReplayIntegration = vi.fn(() => ({ name: 'replay' }));
const mockConsoleLoggingIntegration = vi.fn(() => ({ name: 'consoleLogging' }));
const mockBrowserTracingIntegration = vi.fn(() => ({ name: 'browserTracing' }));
const mockSpotlightBrowserIntegration = vi.fn(() => ({ name: 'spotlightBrowser' }));

vi.mock('@sentry/nextjs', () => ({
  init: mockSentryInit,
  captureRouterTransitionStart: mockCaptureRouterTransitionStart,
  replayIntegration: mockReplayIntegration,
  consoleLoggingIntegration: mockConsoleLoggingIntegration,
  browserTracingIntegration: mockBrowserTracingIntegration,
  spotlightBrowserIntegration: mockSpotlightBrowserIntegration,
}));

describe('instrumentation-client', () => {
  beforeEach(() => {
    vi.resetModules();
    mockSentryInit.mockClear();
    mockReplayIntegration.mockClear();
    mockConsoleLoggingIntegration.mockClear();
    mockBrowserTracingIntegration.mockClear();
    mockSpotlightBrowserIntegration.mockClear();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('Sentry initialization', () => {
    it('should skip initialization when SENTRY_DISABLED is true', async () => {
      vi.doMock('@lmring/env', () => ({
        env: {
          NEXT_PUBLIC_SENTRY_DISABLED: 'true',
        },
      }));

      await import('./instrumentation-client');

      expect(mockSentryInit).not.toHaveBeenCalled();
    });

    it('should skip initialization when SENTRY_DISABLED is TRUE (case insensitive)', async () => {
      vi.doMock('@lmring/env', () => ({
        env: {
          NEXT_PUBLIC_SENTRY_DISABLED: 'TRUE',
        },
      }));

      await import('./instrumentation-client');

      expect(mockSentryInit).not.toHaveBeenCalled();
    });

    it('should initialize Sentry when not disabled', async () => {
      vi.doMock('@lmring/env', () => ({
        env: {
          NEXT_PUBLIC_SENTRY_DISABLED: 'false',
          NEXT_PUBLIC_SENTRY_DSN: 'https://sentry.example.com/789',
          NODE_ENV: 'production',
        },
      }));

      await import('./instrumentation-client');

      expect(mockSentryInit).toHaveBeenCalledTimes(1);
    });

    it('should include standard integrations in production', async () => {
      vi.doMock('@lmring/env', () => ({
        env: {
          NEXT_PUBLIC_SENTRY_DISABLED: 'false',
          NEXT_PUBLIC_SENTRY_DSN: 'https://sentry.example.com/789',
          NODE_ENV: 'production',
        },
      }));

      await import('./instrumentation-client');

      expect(mockReplayIntegration).toHaveBeenCalled();
      expect(mockConsoleLoggingIntegration).toHaveBeenCalled();
      expect(mockBrowserTracingIntegration).toHaveBeenCalled();
      expect(mockSpotlightBrowserIntegration).not.toHaveBeenCalled();
    });

    it('should include spotlightBrowserIntegration in development', async () => {
      vi.doMock('@lmring/env', () => ({
        env: {
          NEXT_PUBLIC_SENTRY_DISABLED: 'false',
          NEXT_PUBLIC_SENTRY_DSN: 'https://sentry.example.com/789',
          NODE_ENV: 'development',
        },
      }));

      await import('./instrumentation-client');

      expect(mockReplayIntegration).toHaveBeenCalled();
      expect(mockConsoleLoggingIntegration).toHaveBeenCalled();
      expect(mockBrowserTracingIntegration).toHaveBeenCalled();
      expect(mockSpotlightBrowserIntegration).toHaveBeenCalled();
    });

    it('should configure correct sampling rates', async () => {
      vi.doMock('@lmring/env', () => ({
        env: {
          NEXT_PUBLIC_SENTRY_DISABLED: 'false',
          NEXT_PUBLIC_SENTRY_DSN: 'https://sentry.example.com/789',
          NODE_ENV: 'production',
        },
      }));

      await import('./instrumentation-client');

      expect(mockSentryInit).toHaveBeenCalledWith(
        expect.objectContaining({
          tracesSampleRate: 1,
          replaysSessionSampleRate: 0.1,
          replaysOnErrorSampleRate: 1.0,
        }),
      );
    });

    it('should configure debug and sampling options', async () => {
      vi.doMock('@lmring/env', () => ({
        env: {
          NEXT_PUBLIC_SENTRY_DISABLED: 'false',
          NEXT_PUBLIC_SENTRY_DSN: 'https://sentry.example.com/789',
          NODE_ENV: 'production',
        },
      }));

      await import('./instrumentation-client');

      expect(mockSentryInit).toHaveBeenCalledWith(
        expect.objectContaining({
          tracesSampleRate: 1,
          debug: false,
        }),
      );
    });
  });

  describe('onRouterTransitionStart export', () => {
    it('should export Sentry.captureRouterTransitionStart', async () => {
      vi.doMock('@lmring/env', () => ({
        env: {
          NEXT_PUBLIC_SENTRY_DISABLED: 'true',
        },
      }));

      const { onRouterTransitionStart } = await import('./instrumentation-client');

      expect(onRouterTransitionStart).toBe(mockCaptureRouterTransitionStart);
    });
  });
});
