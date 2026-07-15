import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import withBundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';
import '@lmring/env/config';
import { env } from '@lmring/env';

const monorepoRoot = resolve(import.meta.dirname, '../..');

const appVersion = JSON.parse(readFileSync(resolve(monorepoRoot, 'package.json'), 'utf-8')).version;

// Vercel has its own deploy adapter and does not need standalone output.
// Forcing standalone on Vercel (esp. Next canary + Turbopack) can fail in
// onBuildComplete with: ENOENT .next/next-server.js.nft.json
// Keep standalone for Docker / self-host (see Dockerfile).
const isVercel = process.env.VERCEL === '1';

const baseConfig: NextConfig = {
  ...(isVercel ? {} : { output: 'standalone' as const }),
  // Trace from monorepo root so workspace packages are included in NFT output
  outputFileTracingRoot: monorepoRoot,
  poweredByHeader: false,
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=()',
        },
      ],
    },
  ],
  experimental: {
    useTypeScriptCli: true,
    optimizePackageImports: [
      'lucide-react',
      '@lobehub/icons',
      '@lobehub/ui',
      '@radix-ui/react-icons',
      'recharts',
      'date-fns',
      '@lmring/ui',
      '@lmring/model-depot',
    ],
  },
  transpilePackages: [
    '@lmring/database',
    '@lmring/ui',
    '@lmring/auth',
    '@lmring/ai-hub',
    '@lmring/i18n',
    '@lmring/env',
    '@lobehub/icons',
    '@lobehub/ui',
    '@lobehub/fluent-emoji',
  ],
  outputFileTracingIncludes: {
    '/': ['./migrations/**/*'],
  },
};

let configWithPlugins: NextConfig = baseConfig;

if (env.ANALYZE === 'true') {
  configWithPlugins = withBundleAnalyzer()(configWithPlugins);
}

const sentryDisabled = env.NEXT_PUBLIC_SENTRY_DISABLED === 'true';
const hasSentryConfig = !!env.SENTRY_ORGANIZATION && !!env.SENTRY_PROJECT;
if (!sentryDisabled && hasSentryConfig) {
  configWithPlugins = withSentryConfig(configWithPlugins, {
    org: env.SENTRY_ORGANIZATION as string,
    project: env.SENTRY_PROJECT as string,
    silent: !env.CI,

    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    reactComponentAnnotation: {
      enabled: true,
    },

    // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
    // side errors will fail.
    tunnelRoute: '/monitoring',

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,

    // Disable Sentry telemetry
    telemetry: false,
  });
}

const nextConfig = configWithPlugins;
export default nextConfig;
