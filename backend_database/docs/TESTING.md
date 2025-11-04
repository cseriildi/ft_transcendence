# Route testing with Vitest + Fastify

This project uses Vitest and Fastify's built-in `inject()` for fast, isolated route tests with an in-memory SQLite DB.

## Quick start

- Run tests:

```bash
npm test
```

- Watch mode:

```bash
npm run test:watch
```

## How it works

- `src/main.ts` exports `build(opts)` which builds (but does not listen) a Fastify instance. Tests call this to get an app.
- `tests/setup.ts` creates a test app with:
  - logger: false
  - database.path: `:memory:` (SQLite in-memory)
  - disableRateLimit: true (keeps tests snappy)
- Tests use `app.inject({ method, url, payload })` for requests.

## Add a new route test

1. Create a file in `tests/` ending with `.test.ts`.
2. Use the helpers from `tests/setup.ts`.

Example skeleton:

```ts
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import { FastifyInstance } from 'fastify'
import { createTestApp, cleanupTestApp } from './setup'

describe('My Feature', () => {
  let app: FastifyInstance

  beforeAll(async () => { app = await createTestApp() })
  afterAll(async () => { await cleanupTestApp(app) })

  it('GET /my-route should work', async () => {
    const res = await app.inject({ method: 'GET', url: '/my-route' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    // assertions...
  })
})
```

## Notes

- Keep controllers pure and return typed responses. Let the global error handler map `AppError`s.
- If you need seeds/fixtures, add helpers in `tests/setup.ts` or a new `tests/helpers.ts`.
- To debug a single test: `vitest -t "your test name"` or run via Test Explorer.
