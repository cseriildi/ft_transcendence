import { FastifyInstance } from 'fastify'
import { build } from '../src/main.ts'

export async function createTestApp(): Promise<FastifyInstance> {
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
      app.db.run('DELETE FROM friends', [], (err2) => {
        if (err2) return reject(err2)
        app.db.run('DELETE FROM matches', [], (err3) => {
          if (err3) return reject(err3)
          app.db.run('DELETE FROM users', [], (err4) => (err4 ? reject(err4) : resolve()))
        })
      })
    })
  })
}
