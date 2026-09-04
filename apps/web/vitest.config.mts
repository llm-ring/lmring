import path from 'node:path';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      'framer-motion': path.resolve(import.meta.dirname, 'src/__mocks__/framer-motion.ts'),
      '@lmring/theme': path.resolve(import.meta.dirname, 'src/__mocks__/@lmring/theme.ts'),
      '@lmring/ui': path.resolve(import.meta.dirname, 'src/__mocks__/@lmring/ui.tsx'),
      // @sentry/nextjs 10.72+ throws at module scope under happy-dom
      // (getsentry/sentry-javascript#23789). Tests never need the real SDK.
      '@sentry/nextjs': path.resolve(import.meta.dirname, 'src/__mocks__/@sentry/nextjs.ts'),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    silent: 'passed-only',
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 10000,
    hookTimeout: 15000,
    pool: 'threads',
    teardownTimeout: 5000,
    coverage: {
      include: ['src/**/*'],
      exclude: ['src/**/*.stories.{js,jsx,ts,tsx}', 'src/__mocks__/**/*'],
    },
    env: loadEnv('', process.cwd(), ''),
  },
});
