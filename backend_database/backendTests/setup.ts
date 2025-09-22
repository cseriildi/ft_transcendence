import { FastifyInstance } from 'fastify'
import { build } from '../src/main.ts'  

export async function createTestApp(): Promise<FastifyInstance> {
  const app = await build({
    logger: false, // Disable logging during tests
    database: {
      path: ':memory:' // Use in-memory database for tests
    }
  })
  
  return app
}

export async function cleanupTestApp(app: FastifyInstance): Promise<void> {
  await app.close()
}