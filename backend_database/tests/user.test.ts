import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest'
import { FastifyInstance } from 'fastify'
import { createTestApp, cleanupTestApp, resetDatabase } from './setup'
import { config } from '../src/config'

describe('User Routes', () => {
  let app: FastifyInstance
  let userId: number
  let accessToken: string
  const AUTH_PREFIX = config.routes.auth
  const API_PREFIX = config.routes.api

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await cleanupTestApp(app)
  })

  beforeEach(async () => {
    await resetDatabase(app)
    // Create a test user for each test
    const payload = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'securepassword123',
      confirmPassword: 'securepassword123',
    }
    const res = await app.inject({ method: 'POST', url: `${AUTH_PREFIX}/register`, payload })
    const body = res.json() as any
    userId = body.data?.id
    accessToken = body.data?.tokens?.accessToken || ''
  })

  it('GET /users should return all users', async () => {
    const res = await app.inject({ method: 'GET', url: `${API_PREFIX}/users` })
    expect(res.statusCode).toBe(200)
    const body = res.json() as any
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBeGreaterThan(0)
    expect(body.data[0]).toHaveProperty('id')
    expect(body.data[0]).toHaveProperty('username')
    expect(body.data[0]).toHaveProperty('email')
    expect(body.data[0]).not.toHaveProperty('password_hash')
  })

  it('GET /users should return empty array when no users exist', async () => {
    await resetDatabase(app)
    const res = await app.inject({ method: 'GET', url: `${API_PREFIX}/users` })
    expect(res.statusCode).toBe(200)
    const body = res.json() as any
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBe(0)
  })

  it('GET /users/:id should return user by id', async () => {
    const res = await app.inject({ 
      method: 'GET', 
      url: `${API_PREFIX}/users/${userId}`,
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as any
    expect(body.success).toBe(true)
    expect(body.data?.id).toBe(userId)
    expect(body.data?.username).toBe('testuser')
    expect(body.data?.email).toBe('test@example.com')
    expect(body.data).toHaveProperty('created_at')
    expect(body.data).not.toHaveProperty('password_hash')
  })

  it('GET /users/:id should return 403 when accessing another user', async () => {
    const res = await app.inject({ 
      method: 'GET', 
      url: `${API_PREFIX}/users/99999`,
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    })
    expect(res.statusCode).toBe(403)
    const body = res.json() as any
    expect(body.success).toBe(false)
    expect(body.message).toContain('does not match')
  })

  it('GET /users/:id should return 400 for invalid id', async () => {
    const res = await app.inject({ 
      method: 'GET', 
      url: `${API_PREFIX}/users/invalid`,
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    })
    expect(res.statusCode).toBe(400)
    const body = res.json() as any
    expect(body.success).toBe(false)
  })

  it('GET /users/:id should return 401 without access token', async () => {
    const res = await app.inject({ method: 'GET', url: `${API_PREFIX}/users/${userId}` })
    expect(res.statusCode).toBe(401)
    const body = res.json() as any
    expect(body.success).toBe(false)
    expect(body.message).toContain('Access token required')
  })

  it('GET /users should return multiple users', async () => {
    // Create additional users
    await app.inject({
      method: 'POST',
      url: `${AUTH_PREFIX}/register`,
      payload: {
        username: 'user2',
        email: 'user2@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      }
    })
    await app.inject({
      method: 'POST',
      url: `${AUTH_PREFIX}/register`,
      payload: {
        username: 'user3',
        email: 'user3@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      }
    })

    const res = await app.inject({ method: 'GET', url: `${API_PREFIX}/users` })
    expect(res.statusCode).toBe(200)
    const body = res.json() as any
    expect(body.success).toBe(true)
    expect(body.data.length).toBe(3)
  })
})
