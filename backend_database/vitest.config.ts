import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    //this is needed to set env vars before tests run because config file is already loaded
    setupFiles: ['./tests/env-setup.ts'],
    coverage: {
      reporter: ['text', 'lcov'],
    },
  },
  esbuild: {
    target: 'es2022',
  },
})
