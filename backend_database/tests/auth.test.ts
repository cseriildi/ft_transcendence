import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest'
import { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'
import { createTestApp, cleanupTestApp, resetDatabase } from './setup'

describe('Auth Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await cleanupTestApp(app)
  })

  beforeEach(async () => {
    await resetDatabase(app)
  })

  it('POST /register should create a user', async () => {
    const payload = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'securepassword123',
      confirmPassword: 'securepassword123',
    }
    const res = await app.inject({ method: 'POST', url: '/register', payload })
    expect(res.statusCode).toBe(201)
    const body = res.json() as any
    expect(body.success).toBe(true)
    expect(body.data?.username).toBe(payload.username)
    expect(body.data?.email).toBe(payload.email)
  })

  it('POST /register should reject duplicate email', async () => {
    const payload = {
      username: 'user1',
      email: 'dup@example.com',
      password: 'securepassword123',
      confirmPassword: 'securepassword123',
    }
    await app.inject({ method: 'POST', url: '/register', payload })
    const res = await app.inject({ method: 'POST', url: '/register', payload: { ...payload, username: 'user2' } })
    expect(res.statusCode).toBe(409)
    const body = res.json() as any
    expect(body.success).toBe(false)
  })

  it('POST /login should authenticate valid user', async () => {
    const payload = {
      username: 'userlogin',
      email: 'login@example.com',
      password: 'securepassword123',
      confirmPassword: 'securepassword123',
    }
    await app.inject({ method: 'POST', url: '/register', payload })

    const res = await app.inject({ method: 'POST', url: '/login', payload: { email: payload.email, password: payload.password } })
    expect(res.statusCode).toBe(200)
    const body = res.json() as any
    expect(body.success).toBe(true)
    expect(body.data?.email).toBe(payload.email)
  })

  it('POST /login should reject wrong password', async () => {
    const payload = {
      username: 'userlogin2',
      email: 'login2@example.com',
      password: 'securepassword123',
      confirmPassword: 'securepassword123',
    }
    await app.inject({ method: 'POST', url: '/register', payload })

    const res = await app.inject({ method: 'POST', url: '/login', payload: { email: payload.email, password: 'wrongpass123' } })
    expect(res.statusCode).toBe(401)
    const body = res.json() as any
    expect(body.success).toBe(false)
  })
})
