import { defineConfig } from 'vitest/config';

export const baseConfig = defineConfig({
  test: {
    globals: false,
    silent: 'passed-only',
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.stories.{ts,tsx}', 'src/**/index.ts'],
      reporter: ['text', 'json', 'lcov', 'text-summary'],
    },
    passWithNoTests: true,
  },
});
