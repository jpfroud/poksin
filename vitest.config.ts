import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/server/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/server/**/*.ts'],
      reporter: ['text', 'json-summary', 'html'],
      thresholds: { statements: 80, lines: 80, branches: 70, functions: 80 },
    },
  },
});
