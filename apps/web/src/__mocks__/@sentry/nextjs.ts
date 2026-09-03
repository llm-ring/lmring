import { type Mock, vi } from 'vitest';

export const captureException: Mock = vi.fn();
export const captureMessage: Mock = vi.fn();
export const init: Mock = vi.fn();
export const captureRouterTransitionStart: Mock = vi.fn();
export const captureRequestError: Mock = vi.fn();
export const replayIntegration: Mock<() => { name: string }> = vi.fn(() => ({ name: 'replay' }));
export const consoleLoggingIntegration: Mock<() => { name: string }> = vi.fn(() => ({
  name: 'consoleLogging',
}));
export const browserTracingIntegration: Mock<() => { name: string }> = vi.fn(() => ({
  name: 'browserTracing',
}));
export const spotlightBrowserIntegration: Mock<() => { name: string }> = vi.fn(() => ({
  name: 'spotlightBrowser',
}));
export const withSentryConfig = <T>(config: T): T => config;

const sentryNextjsMock = {
  captureException,
  captureMessage,
  init,
  captureRouterTransitionStart,
  captureRequestError,
  replayIntegration,
  consoleLoggingIntegration,
  browserTracingIntegration,
  spotlightBrowserIntegration,
  withSentryConfig,
};

export default sentryNextjsMock;
