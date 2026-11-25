import { env } from '@lmring/env';
import * as Sentry from '@sentry/nextjs';

const sentryOptions: Sentry.NodeOptions | Sentry.EdgeOptions = {
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  spotlight: env.NODE_ENV === 'development',
  integrations: [Sentry.consoleLoggingIntegration()],
  tracesSampleRate: 1,
  debug: false,
};

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const shouldLogMissingDatabaseUrl = env.DATABASE_URL === '' || !env.DATABASE_URL;
    if (shouldLogMissingDatabaseUrl) {
      console.error('DATABASE_URL not configured, database features may be unavailable');
    }
    // Handled separately via CI/CD or manual commands
    console.info('Skipping automatic database migrations in instrumentation startup');
  }

  const sentryDisabled = (env.NEXT_PUBLIC_SENTRY_DISABLED ?? '').toLowerCase() === 'true';
  if (!sentryDisabled) {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      Sentry.init(sentryOptions);
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
      Sentry.init(sentryOptions);
    }
  }
}

export const onRequestError = Sentry.captureRequestError;
