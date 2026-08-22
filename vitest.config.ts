import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    alias: {
      '@': resolve(__dirname, './src'),
    },
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/tests/e2e/**'],
  },
});
