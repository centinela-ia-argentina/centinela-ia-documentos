import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/security/**/*.test.ts'],
    exclude: ['tests/security/drift.test.ts'],
    fileParallelism: false,
  },
});
