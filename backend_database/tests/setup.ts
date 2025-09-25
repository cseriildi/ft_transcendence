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
  await app.close()
}

export async function resetDatabase(app: FastifyInstance): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    app.db.run('DELETE FROM matches', [], (err) => {
      if (err) return reject(err)
      app.db.run('DELETE FROM users', [], (err2) => (err2 ? reject(err2) : resolve()))
    })
  })
}
