import { FastifyInstance } from 'fastify'
import { build } from '../src/main.ts'

export async function createTestApp(): Promise<FastifyInstance> {
  // Set test OAuth environment variables if not already set
  if (!process.env.GITHUB_CLIENT_ID) {
    process.env.GITHUB_CLIENT_ID = 'test_client_id'
  }
  if (!process.env.GITHUB_CLIENT_SECRET) {
    process.env.GITHUB_CLIENT_SECRET = 'test_client_secret'
  }
  if (!process.env.GITHUB_REDIRECT_URI) {
    process.env.GITHUB_REDIRECT_URI = 'http://localhost:3000/oauth/oauth/github/callback'
  }

  const app = await build({
    logger: false,
    database: { path: ':memory:' },
    disableRateLimit: true,
  })
  return app
}

export async function cleanupTestApp(app: FastifyInstance): Promise<void> {
  if (app) {
    await app.close()
  }
}

export async function resetDatabase(app: FastifyInstance): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    app.db.run('DELETE FROM refresh_tokens', [], (err) => {
      if (err) return reject(err)
      app.db.run('DELETE FROM matches', [], (err2) => {
        if (err2) return reject(err2)
        app.db.run('DELETE FROM users', [], (err3) => (err3 ? reject(err3) : resolve()))
      })
    })
  })
}
