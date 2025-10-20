import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest'
import { FastifyInstance } from 'fastify'
import { createTestApp, cleanupTestApp, resetDatabase } from './setup'
import { config } from '../src/config'
import bcrypt from 'bcrypt'
import { DatabaseHelper } from '../src/utils/databaseUtils'
import { jwtVerify } from 'jose'

const REFRESH_SECRET = new TextEncoder().encode(
  process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-change-me"
)

describe('Refresh Token Cookie & Database Debug Tests', () => {
  let app: FastifyInstance
  const AUTH_PREFIX = config.routes.auth

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await cleanupTestApp(app)
  })

  beforeEach(async () => {
    await resetDatabase(app)
  })

  it('Should set refresh token cookie on registration and verify it matches database', async () => {
    const payload = {
      username: 'cookietest',
      email: 'cookietest@example.com',
      password: 'securepassword123',
      confirmPassword: 'securepassword123',
    }

    // Register user
    const registerRes = await app.inject({ 
      method: 'POST', 
      url: `${AUTH_PREFIX}/register`, 
      payload 
    })
    
    console.log('Register response status:', registerRes.statusCode)
    console.log('Register response cookies:', registerRes.cookies)
    
    expect(registerRes.statusCode).toBe(201)
    const body = registerRes.json() as any
    expect(body.success).toBe(true)
    
    // Check cookie is set
    const cookies = registerRes.cookies
    expect(cookies).toBeDefined()
    expect(cookies.length).toBeGreaterThan(0)
    
    const refreshCookie = cookies.find((c: any) => c.name === 'refresh_token')
    console.log('Refresh token cookie:', refreshCookie)
    
    expect(refreshCookie).toBeDefined()
    expect(refreshCookie?.value).toBeDefined()
    expect(refreshCookie?.httpOnly).toBe(true)
    expect(refreshCookie?.path).toBe('/auth')
    
    // Get user from database
    const userId = body.data.id
    console.log('User ID:', userId)
    
    // Query refresh tokens from database
    const dbHelper = new DatabaseHelper(app.db)
    const tokens = await dbHelper.all<any>(
      "SELECT jti, user_id, token_hash, expires_at, revoked FROM refresh_tokens WHERE user_id = ?",
      [userId]
    )
    
    console.log('Database refresh tokens:', tokens)
    expect(tokens.length).toBe(1)
    
    const storedToken = tokens[0]
    expect(storedToken.user_id).toBe(userId)
    expect(storedToken.revoked).toBe(0)
    
    // Verify the cookie value matches the database hash
    const cookieValue = refreshCookie!.value
    const hashMatch = await bcrypt.compare(cookieValue, storedToken.token_hash)
    console.log('Cookie value matches database hash:', hashMatch)
    expect(hashMatch).toBe(true)
  })

  it('Should set refresh token cookie on login and verify it matches database', async () => {
    // First register
    const payload = {
      username: 'logintest',
      email: 'logintest@example.com',
      password: 'securepassword123',
      confirmPassword: 'securepassword123',
    }
    
    const registerRes = await app.inject({ 
      method: 'POST', 
      url: `${AUTH_PREFIX}/register`, 
      payload 
    })
    const userId = registerRes.json<any>().data.id
    
    // Now login
    const loginRes = await app.inject({
      method: 'POST',
      url: `${AUTH_PREFIX}/login`,
      payload: {
        email: payload.email,
        password: payload.password
      }
    })
    
    console.log('Login response status:', loginRes.statusCode)
    console.log('Login response cookies:', loginRes.cookies)
    
    expect(loginRes.statusCode).toBe(200)
    
    // Check cookie
    const cookies = loginRes.cookies
    const refreshCookie = cookies.find((c: any) => c.name === 'refresh_token')
    console.log('Login refresh token cookie:', refreshCookie)
    
    expect(refreshCookie).toBeDefined()
    expect(refreshCookie?.value).toBeDefined()
    
    // Query database - should have 2 tokens now (one from register, one from login)
    const dbHelper = new DatabaseHelper(app.db)
    const tokens = await dbHelper.all<any>(
      "SELECT jti, user_id, token_hash, expires_at, revoked, created_at FROM refresh_tokens WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    )
    
    console.log('Database refresh tokens after login:', tokens)
    expect(tokens.length).toBe(2) // One from register, one from login
    
    // Decode the cookie to get the jti
    const cookieValue = refreshCookie!.value
    const { payload: jwtPayload } = await jwtVerify(cookieValue, REFRESH_SECRET)
    const cookieJti = jwtPayload.jti
    
    // Find the matching token in the database by jti
    const matchingToken = tokens.find((t: any) => t.jti === cookieJti)
    expect(matchingToken).toBeDefined()
    
    const hashMatch = await bcrypt.compare(cookieValue, matchingToken.token_hash)
    console.log('Login cookie matches database hash:', hashMatch)
    expect(hashMatch).toBe(true)
  })

  it('Should accept refresh token from cookie and return new token matching database', async () => {
    // Register first
    const payload = {
      username: 'refreshtest',
      email: 'refreshtest@example.com',
      password: 'securepassword123',
      confirmPassword: 'securepassword123',
    }
    
    const registerRes = await app.inject({ 
      method: 'POST', 
      url: `${AUTH_PREFIX}/register`, 
      payload 
    })
    const userId = registerRes.json<any>().data.id
    const registerCookie = registerRes.cookies.find((c: any) => c.name === 'refresh_token')
    
    console.log('Initial refresh token from register:', registerCookie?.value)
    
    // Call refresh endpoint with the cookie
    const refreshRes = await app.inject({
      method: 'POST',
      url: `${AUTH_PREFIX}/refresh`,
      cookies: { refresh_token: registerCookie!.value }
    })
    
    console.log('Refresh response status:', refreshRes.statusCode)
    console.log('Refresh response body:', refreshRes.json())
    console.log('Refresh response cookies:', refreshRes.cookies)
    
    expect(refreshRes.statusCode).toBe(200)
    const refreshBody = refreshRes.json() as any
    expect(refreshBody.success).toBe(true)
    expect(refreshBody.data.tokens.accessToken).toBeDefined()
    
    // Should get new refresh token cookie
    const newRefreshCookie = refreshRes.cookies.find((c: any) => c.name === 'refresh_token')
    console.log('New refresh token from refresh endpoint:', newRefreshCookie?.value)
    
    expect(newRefreshCookie).toBeDefined()
    expect(newRefreshCookie?.value).not.toBe(registerCookie!.value)
    
    // Check database - old token should be deleted, new one should exist
    const dbHelper = new DatabaseHelper(app.db)
    const tokens = await dbHelper.all<any>(
      "SELECT jti, user_id, token_hash, expires_at, revoked FROM refresh_tokens WHERE user_id = ?",
      [userId]
    )
    
    console.log('Database tokens after refresh:', tokens)
    expect(tokens.length).toBe(1) // Old deleted, only new one remains
    
    // Verify new cookie matches database
    const cookieValue = newRefreshCookie!.value
    const hashMatch = await bcrypt.compare(cookieValue, tokens[0].token_hash)
    console.log('New refresh cookie matches database:', hashMatch)
    expect(hashMatch).toBe(true)
  })

  it('Should fail refresh when no cookie is sent', async () => {
    const refreshRes = await app.inject({
      method: 'POST',
      url: `${AUTH_PREFIX}/refresh`,
      // No cookies
    })
    
    console.log('Refresh without cookie - status:', refreshRes.statusCode)
    console.log('Refresh without cookie - body:', refreshRes.json())
    
    expect(refreshRes.statusCode).toBe(401)
    const body = refreshRes.json() as any
    expect(body.success).toBe(false)
    expect(body.message).toContain('No refresh token provided')
  })

  it('Should fail refresh with invalid cookie value', async () => {
    const refreshRes = await app.inject({
      method: 'POST',
      url: `${AUTH_PREFIX}/refresh`,
      cookies: { refresh_token: 'invalid-token-value' }
    })
    
    console.log('Refresh with invalid cookie - status:', refreshRes.statusCode)
    console.log('Refresh with invalid cookie - body:', refreshRes.json())
    
    expect(refreshRes.statusCode).toBe(401)
    const body = refreshRes.json() as any
    expect(body.success).toBe(false)
  })

  it('Should revoke token and clear cookie on logout', async () => {
    // Register first
    const payload = {
      username: 'logouttest',
      email: 'logouttest@example.com',
      password: 'securepassword123',
      confirmPassword: 'securepassword123',
    }
    
    const registerRes = await app.inject({ 
      method: 'POST', 
      url: `${AUTH_PREFIX}/register`, 
      payload 
    })
    const userId = registerRes.json<any>().data.id
    const refreshCookie = registerRes.cookies.find((c: any) => c.name === 'refresh_token')
    
    console.log('Refresh token before logout:', refreshCookie?.value)
    
    // Logout
    const logoutRes = await app.inject({
      method: 'POST',
      url: `${AUTH_PREFIX}/logout`,
      cookies: { refresh_token: refreshCookie!.value }
    })
    
    console.log('Logout response status:', logoutRes.statusCode)
    console.log('Logout response cookies:', logoutRes.cookies)
    
    expect(logoutRes.statusCode).toBe(200)
    
    // Check database - token should be revoked
    const dbHelper = new DatabaseHelper(app.db)
    const tokens = await dbHelper.all<any>(
      "SELECT jti, user_id, token_hash, expires_at, revoked FROM refresh_tokens WHERE user_id = ?",
      [userId]
    )
    
    console.log('Database tokens after logout:', tokens)
    expect(tokens.length).toBe(1)
    expect(tokens[0].revoked).toBe(1) // Should be marked as revoked
    
    // Try to use the same token - should fail
    const refreshRes = await app.inject({
      method: 'POST',
      url: `${AUTH_PREFIX}/refresh`,
      cookies: { refresh_token: refreshCookie!.value }
    })
    
    console.log('Refresh after logout - status:', refreshRes.statusCode)
    expect(refreshRes.statusCode).toBe(401)
  })

  it('Should check cookie properties in detail', async () => {
    const payload = {
      username: 'cookieprops',
      email: 'cookieprops@example.com',
      password: 'securepassword123',
      confirmPassword: 'securepassword123',
    }

    const res = await app.inject({ 
      method: 'POST', 
      url: `${AUTH_PREFIX}/register`, 
      payload 
    })
    
    const refreshCookie = res.cookies.find((c: any) => c.name === 'refresh_token')
    
    console.log('Cookie full details:', JSON.stringify(refreshCookie, null, 2))
    
    expect(refreshCookie).toBeDefined()
    expect(refreshCookie?.name).toBe('refresh_token')
    expect(refreshCookie?.httpOnly).toBe(true)
    expect(refreshCookie?.path).toBe('/auth')
    expect(refreshCookie?.sameSite).toBeDefined()
    expect(refreshCookie?.maxAge).toBeDefined()
    
    // In test environment, secure may not be set (defaults to false in non-production)
    // Just check that it's either false or undefined (not true)
    expect(refreshCookie?.secure).not.toBe(true)
  })
})
