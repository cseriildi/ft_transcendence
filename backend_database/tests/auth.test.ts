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

  it('POST /login should return access token and set refresh cookie', async () => {
    const payload = {
      username: 'tokenuser',
      email: 'token@example.com',
      password: 'securepassword123',
      confirmPassword: 'securepassword123',
    }
    await app.inject({ method: 'POST', url: '/register', payload })

    const res = await app.inject({ method: 'POST', url: '/login', payload: { email: payload.email, password: payload.password } })
    expect(res.statusCode).toBe(200)
    const body = res.json() as any
    expect(body.success).toBe(true)
    expect(body.data?.tokens?.accessToken).toBeDefined()
    
    // Check for refresh_token cookie
    const cookies = res.cookies
    expect(cookies).toBeDefined()
    const refreshCookie = cookies.find((c: any) => c.name === 'refresh_token')
    expect(refreshCookie).toBeDefined()
    expect(refreshCookie?.httpOnly).toBe(true)
  })

  it('POST /refresh should rotate tokens with valid refresh cookie', async () => {
    const payload = {
      username: 'refreshuser',
      email: 'refresh@example.com',
      password: 'securepassword123',
      confirmPassword: 'securepassword123',
    }
    const loginRes = await app.inject({ method: 'POST', url: '/register', payload })
    const refreshCookie = loginRes.cookies.find((c: any) => c.name === 'refresh_token')
    expect(refreshCookie).toBeDefined()

    // Use refresh token
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/refresh',
      cookies: { refresh_token: refreshCookie!.value }
    })
    expect(refreshRes.statusCode).toBe(200)
    const body = refreshRes.json() as any
    expect(body.success).toBe(true)
    expect(body.data?.tokens?.accessToken).toBeDefined()
    
    // Should get new refresh token
    const newRefreshCookie = refreshRes.cookies.find((c: any) => c.name === 'refresh_token')
    expect(newRefreshCookie).toBeDefined()
    expect(newRefreshCookie?.value).not.toBe(refreshCookie!.value)
  })

  it('POST /refresh should reject without refresh cookie', async () => {
    const res = await app.inject({ method: 'POST', url: '/refresh' })
    expect(res.statusCode).toBe(401)
    const body = res.json() as any
    expect(body.success).toBe(false)
  })

  it('POST /logout should revoke refresh token and clear cookie', async () => {
    const payload = {
      username: 'logoutuser',
      email: 'logout@example.com',
      password: 'securepassword123',
      confirmPassword: 'securepassword123',
    }
    const loginRes = await app.inject({ method: 'POST', url: '/register', payload })
    const refreshCookie = loginRes.cookies.find((c: any) => c.name === 'refresh_token')
    expect(refreshCookie).toBeDefined()

    // Logout
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/logout',
      cookies: { refresh_token: refreshCookie!.value }
    })
    expect(logoutRes.statusCode).toBe(200)
    const body = logoutRes.json() as any
    expect(body.success).toBe(true)

    // Try to use the same refresh token - should fail
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/refresh',
      cookies: { refresh_token: refreshCookie!.value }
    })
    expect(refreshRes.statusCode).toBe(401)
  })

  it('POST /logout should fail without refresh cookie', async () => {
    const res = await app.inject({ method: 'POST', url: '/logout' })
    expect(res.statusCode).toBe(401)
    const body = res.json() as any
    expect(body.success).toBe(false)
  })
})
