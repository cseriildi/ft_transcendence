import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import { FastifyInstance } from 'fastify'
import { createTestApp, cleanupTestApp } from './setup'

describe('Health Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await cleanupTestApp(app)
  })

  it('GET / should return welcome payload', async () => {
    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as any
    expect(body.success).toBe(true)
    expect(body.data?.message).toBe('Welcome to the API')
  })

  it('GET /health should return healthy status', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as any
    expect(body.success).toBe(true)
    expect(body.data?.status).toBe('healthy')
  })
})
