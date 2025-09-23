import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: [],
    coverage: {
      reporter: ['text', 'lcov'],
    },
  },
  esbuild: {
    target: 'es2022',
  },
})
