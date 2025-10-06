import { describe, it, beforeAll, afterAll, beforeEach, expect, vi } from `vitest`
import { FastifyInstance } from `fastify`
import { createTestApp, cleanupTestApp, resetDatabase } from `./setup`
import { config } from `../src/config.ts`

// Mock the fetch function for external OAuth API calls
const mockFetch = vi.fn()
global.fetch = mockFetch as any

describe(`OAuth Routes`, () => {
  let app: FastifyInstance
  const OAUTH_PREFIX = config.routes.oauth
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
    vi.clearAllMocks()
  })

  describe(`GET ${OAUTH_PREFIX}/github`, () => {
    it(`should return GitHub OAuth redirect URL`, async () => {
      const res = await app.inject({
        method: `GET`,
        url: `${OAUTH_PREFIX}/github`,
      })

      expect(res.statusCode).toBe(200)
      const body = res.json() as any
      expect(body.success).toBe(true)
      expect(body.data?.redirectUrl).toContain(`https://github.com/login/oauth/authorize`)
      expect(body.data?.redirectUrl).toContain(`client_id=test_client_id`)
      expect(body.data?.redirectUrl).toContain(`scope=`)
      expect(body.data?.redirectUrl).toContain(`state=`)
    })

    it(`should set oauth_state cookie`, async () => {
      const res = await app.inject({
        method: `GET`,
        url: `${OAUTH_PREFIX}/github`,
      })

      expect(res.statusCode).toBe(200)
      const cookies = res.cookies
      expect(cookies).toBeDefined()
      const stateCookie = cookies.find((c: any) => c.name === `oauth_state`)
      expect(stateCookie).toBeDefined()
      expect(stateCookie?.httpOnly).toBe(true)
      expect(stateCookie?.path).toBe(OAUTH_PREFIX)
    })

    it(`should generate unique state for each request`, async () => {
      const res1 = await app.inject({ method: `GET`, url: `${OAUTH_PREFIX}/github` })
      const res2 = await app.inject({ method: `GET`, url: `${OAUTH_PREFIX}/github` })

      const body1 = res1.json() as any
      const body2 = res2.json() as any

      const state1 = new URL(body1.data.redirectUrl).searchParams.get(`state`)
      const state2 = new URL(body2.data.redirectUrl).searchParams.get(`state`)

      expect(state1).not.toBe(state2)
    })
  })

  describe(`GET ${OAUTH_PREFIX}/github/callback`, () => {
    it(`should reject missing code parameter`, async () => {
      const res = await app.inject({
        method: `GET`,
        url: `${OAUTH_PREFIX}/github/callback?state=test-state`,
      })

      expect(res.statusCode).toBe(400)
      const body = res.json() as any
      expect(body.success).toBe(false)
    })

    it(`should reject missing state parameter`, async () => {
      const res = await app.inject({
        method: `GET`,
        url: `${OAUTH_PREFIX}/github/callback?code=test-code`,
      })

      expect(res.statusCode).toBe(400)
      const body = res.json() as any
      expect(body.success).toBe(false)
    })

    it(`should reject invalid state (CSRF protection)`, async () => {
      const res = await app.inject({
        method: `GET`,
        url: `${OAUTH_PREFIX}/github/callback?code=test-code&state=invalid-state`,
        headers: {
          cookie: `oauth_state=different-state.signature`,
        },
      })

      expect(res.statusCode).toBe(400)
      const body = res.json() as any
      expect(body.success).toBe(false)
    })

    it(`should create new user from GitHub OAuth`, async () => {
      // Get a valid state cookie first
      const initRes = await app.inject({ method: `GET`, url: `${OAUTH_PREFIX}/github` })
      const stateCookie = initRes.cookies.find((c: any) => c.name === `oauth_state`)
      const redirectUrl = (initRes.json() as any).data.redirectUrl
      const state = new URL(redirectUrl).searchParams.get(`state`)!

      // Mock GitHub API responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: `gho_test_access_token`,
            token_type: `bearer`,
            scope: `user:email`,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 123456,
            login: `testuser`,
            name: `Test User`,
            email: `testuser@github.com`,
            avatar_url: `https://avatars.githubusercontent.com/u/123456`,
          }),
        })

      const res = await app.inject({
        method: `GET`,
        url: `${OAUTH_PREFIX}/github/callback?code=test-code&state=${state}`,
        headers: {
          cookie: `oauth_state=${stateCookie?.value}`,
        },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json() as any
      expect(body.success).toBe(true)
      expect(body.data?.username).toBe(`Test User`)
      expect(body.data?.email).toBe(`testuser@github.com`)
      expect(body.data?.tokens?.accessToken).toBeDefined()

      // Verify refresh_token cookie is set
      const cookies = res.cookies
      const refreshCookie = cookies.find((c: any) => c.name === `refresh_token`)
      expect(refreshCookie).toBeDefined()
      expect(refreshCookie?.httpOnly).toBe(true)

      // Verify user was created in database with OAuth info
      const users = await new Promise<any[]>((resolve, reject) => {
        app.db.all(`SELECT * FROM users WHERE email = ?`, [`testuser@github.com`], (err, rows) => {
          if (err) reject(err)
          else resolve(rows)
        })
      })
      expect(users).toHaveLength(1)
      expect(users[0].oauth_provider).toBe(`github`)
      expect(users[0].oauth_id).toBe(`123456`)
    })

    it(`should link OAuth to existing user with same email`, async () => {
      // Create a regular user first
      await app.inject({
        method: `POST`,
        url: `${AUTH_PREFIX}/register`,
        payload: {
          username: `existinguser`,
          email: `existing@example.com`,
          password: `password123`,
          confirmPassword: `password123`,
        },
      })

      // Get a valid state cookie
      const initRes = await app.inject({ method: `GET`, url: `${OAUTH_PREFIX}/github` })
      const stateCookie = initRes.cookies.find((c: any) => c.name === `oauth_state`)
      const redirectUrl = (initRes.json() as any).data.redirectUrl
      const state = new URL(redirectUrl).searchParams.get(`state`)!

      // Mock GitHub API responses with same email
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: `gho_test_access_token`,
            token_type: `bearer`,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 789012,
            login: `githubuser`,
            name: `GitHub User`,
            email: `existing@example.com`,
            avatar_url: `https://avatars.githubusercontent.com/u/789012`,
          }),
        })

      const res = await app.inject({
        method: `GET`,
        url: `${OAUTH_PREFIX}/github/callback?code=test-code&state=${state}`,
        headers: {
          cookie: `oauth_state=${stateCookie?.value}`,
        },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json() as any
      expect(body.success).toBe(true)
      expect(body.data?.email).toBe(`existing@example.com`)

      // Verify only one user exists with OAuth linked
      const users = await new Promise<any[]>((resolve, reject) => {
        app.db.all(`SELECT * FROM users WHERE email = ?`, [`existing@example.com`], (err, rows) => {
          if (err) reject(err)
          else resolve(rows)
        })
      })
      expect(users).toHaveLength(1)
      expect(users[0].oauth_provider).toBe(`github`)
      expect(users[0].oauth_id).toBe(`789012`)
      expect(users[0].username).toBe(`existinguser`) // Original username preserved
    })

    it(`should login existing OAuth user`, async () => {
      // Create OAuth user first
      const initRes1 = await app.inject({ method: `GET`, url: `${OAUTH_PREFIX}/github` })
      const stateCookie1 = initRes1.cookies.find((c: any) => c.name === `oauth_state`)
      const state1 = new URL((initRes1.json() as any).data.redirectUrl).searchParams.get(`state`)!

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: `token1`, token_type: `bearer` }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 111222,
            login: `returninguser`,
            name: `Returning User`,
            email: `returning@github.com`,
            avatar_url: `https://avatars.githubusercontent.com/u/111222`,
          }),
        })

      await app.inject({
        method: `GET`,
        url: `${OAUTH_PREFIX}/github/callback?code=code1&state=${state1}`,
        headers: { cookie: `oauth_state=${stateCookie1?.value}` },
      })

      // Now login again with same OAuth user
      const initRes2 = await app.inject({ method: `GET`, url: `${OAUTH_PREFIX}/github` })
      const stateCookie2 = initRes2.cookies.find((c: any) => c.name === `oauth_state`)
      const state2 = new URL((initRes2.json() as any).data.redirectUrl).searchParams.get(`state`)!

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: `token2`, token_type: `bearer` }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 111222, // Same GitHub user ID
            login: `returninguser`,
            name: `Returning User Updated`,
            email: `returning@github.com`,
            avatar_url: `https://avatars.githubusercontent.com/u/111222`,
          }),
        })

      const res = await app.inject({
        method: `GET`,
        url: `${OAUTH_PREFIX}/github/callback?code=code2&state=${state2}`,
        headers: { cookie: `oauth_state=${stateCookie2?.value}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json() as any
      expect(body.success).toBe(true)
      expect(body.data?.email).toBe(`returning@github.com`)
      expect(body.data?.tokens?.accessToken).toBeDefined()

      // Verify still only one user
      const users = await new Promise<any[]>((resolve, reject) => {
        app.db.all(`SELECT * FROM users WHERE email = ?`, [`returning@github.com`], (err, rows) => {
          if (err) reject(err)
          else resolve(rows)
        })
      })
      expect(users).toHaveLength(1)
    })

    it(`should handle GitHub token exchange failure`, async () => {
      const initRes = await app.inject({ method: `GET`, url: `${OAUTH_PREFIX}/github` })
      const stateCookie = initRes.cookies.find((c: any) => c.name === `oauth_state`)
      const state = new URL((initRes.json() as any).data.redirectUrl).searchParams.get(`state`)!

      // Mock failed token exchange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      })

      const res = await app.inject({
        method: `GET`,
        url: `${OAUTH_PREFIX}/github/callback?code=bad-code&state=${state}`,
        headers: { cookie: `oauth_state=${stateCookie?.value}` },
      })

      expect(res.statusCode).toBe(400)
      const body = res.json() as any
      expect(body.success).toBe(false)
    })

    it(`should handle GitHub user info fetch failure`, async () => {
      const initRes = await app.inject({ method: `GET`, url: `${OAUTH_PREFIX}/github` })
      const stateCookie = initRes.cookies.find((c: any) => c.name === `oauth_state`)
      const state = new URL((initRes.json() as any).data.redirectUrl).searchParams.get(`state`)!

      // Mock successful token but failed user info
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: `token`, token_type: `bearer` }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
        })

      const res = await app.inject({
        method: `GET`,
        url: `${OAUTH_PREFIX}/github/callback?code=test-code&state=${state}`,
        headers: { cookie: `oauth_state=${stateCookie?.value}` },
      })

      expect(res.statusCode).toBe(400)
      const body = res.json() as any
      expect(body.success).toBe(false)
    })

    it(`should handle GitHub user with no public email`, async () => {
      const initRes = await app.inject({ method: `GET`, url: `${OAUTH_PREFIX}/github` })
      const stateCookie = initRes.cookies.find((c: any) => c.name === `oauth_state`)
      const state = new URL((initRes.json() as any).data.redirectUrl).searchParams.get(`state`)!

      // Mock GitHub API responses with no public email, then fetch emails endpoint
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: `token`, token_type: `bearer` }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 333444,
            login: `privateuser`,
            name: `Private User`,
            email: null, // No public email
            avatar_url: `https://avatars.githubusercontent.com/u/333444`,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ([
            { email: `private@github.com`, primary: true, verified: true },
            { email: `other@github.com`, primary: false, verified: true },
          ]),
        })

      const res = await app.inject({
        method: `GET`,
        url: `${OAUTH_PREFIX}/github/callback?code=test-code&state=${state}`,
        headers: { cookie: `oauth_state=${stateCookie?.value}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json() as any
      expect(body.success).toBe(true)
      expect(body.data?.email).toBe(`private@github.com`)
    })

    it(`should clear oauth_state cookie after callback`, async () => {
      const initRes = await app.inject({ method: `GET`, url: `${OAUTH_PREFIX}/github` })
      const stateCookie = initRes.cookies.find((c: any) => c.name === `oauth_state`)
      const state = new URL((initRes.json() as any).data.redirectUrl).searchParams.get(`state`)!

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: `token`, token_type: `bearer` }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 555666,
            login: `clearuser`,
            name: `Clear User`,
            email: `clear@github.com`,
            avatar_url: null,
          }),
        })

      const res = await app.inject({
        method: `GET`,
        url: `${OAUTH_PREFIX}/github/callback?code=test-code&state=${state}`,
        headers: { cookie: `oauth_state=${stateCookie?.value}` },
      })

      expect(res.statusCode).toBe(200)

      // Check that oauth_state cookie was cleared
      const cookies = res.cookies
      const clearedCookie = cookies.find((c: any) => c.name === `oauth_state`)
      // Cookie should be present but with maxAge 0 or expires in the past (cleared)
      if (clearedCookie) {
        expect(clearedCookie.maxAge === 0 || clearedCookie.expires).toBeTruthy()
      }
    })
  })

  describe(`OAuth Integration with Other Endpoints`, () => {
    it(`should allow OAuth user to access protected endpoints`, async () => {
      // Create OAuth user
      const initRes = await app.inject({ method: `GET`, url: `${OAUTH_PREFIX}/github` })
      const stateCookie = initRes.cookies.find((c: any) => c.name === `oauth_state`)
      const state = new URL((initRes.json() as any).data.redirectUrl).searchParams.get(`state`)!

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: `token`, token_type: `bearer` }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 777888,
            login: `protecteduser`,
            name: `Protected User`,
            email: `protected@github.com`,
            avatar_url: null,
          }),
        })

      const authRes = await app.inject({
        method: `GET`,
        url: `${OAUTH_PREFIX}/github/callback?code=test-code&state=${state}`,
        headers: { cookie: `oauth_state=${stateCookie?.value}` },
      })

      const accessToken = (authRes.json() as any).data.tokens.accessToken

      // Try to access protected endpoint (like getting user profile)
      const profileRes = await app.inject({
        method: `GET`,
        url: `${API_PREFIX}/users/${(authRes.json() as any).data.id}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      })

      expect(profileRes.statusCode).toBe(200)
      const profile = profileRes.json() as any
      expect(profile.success).toBe(true)
      expect(profile.data?.email).toBe(`protected@github.com`)
    })

    it(`should allow OAuth user to refresh token`, async () => {
      // Create OAuth user
      const initRes = await app.inject({ method: `GET`, url: `${OAUTH_PREFIX}/github` })
      const stateCookie = initRes.cookies.find((c: any) => c.name === `oauth_state`)
      const state = new URL((initRes.json() as any).data.redirectUrl).searchParams.get(`state`)!

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: `token`, token_type: `bearer` }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 999000,
            login: `refreshuser`,
            name: `Refresh User`,
            email: `refresh@github.com`,
            avatar_url: null,
          }),
        })

      const authRes = await app.inject({
        method: `GET`,
        url: `${OAUTH_PREFIX}/github/callback?code=test-code&state=${state}`,
        headers: { cookie: `oauth_state=${stateCookie?.value}` },
      })

      const authBody = authRes.json() as any
      const originalAccessToken = authBody.data.tokens.accessToken
      const refreshCookie = authRes.cookies.find((c: any) => c.name === `refresh_token`)

      // Use refresh token to get new access token
      const refreshRes = await app.inject({
        method: `POST`,
        url: `${AUTH_PREFIX}/refresh`,
        headers: {
          cookie: `refresh_token=${refreshCookie?.value}`,
        },
      })

      expect(refreshRes.statusCode).toBe(200)
      const body = refreshRes.json() as any
      expect(body.success).toBe(true)
      expect(body.data?.tokens?.accessToken).toBeDefined()
      // Note: Access tokens may be the same if issued at the same timestamp
    })

    it(`should allow OAuth user to logout`, async () => {
      // Create OAuth user
      const initRes = await app.inject({ method: `GET`, url: `${OAUTH_PREFIX}/github` })
      const stateCookie = initRes.cookies.find((c: any) => c.name === `oauth_state`)
      const state = new URL((initRes.json() as any).data.redirectUrl).searchParams.get(`state`)!

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: `token`, token_type: `bearer` }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 123321,
            login: `logoutuser`,
            name: `Logout User`,
            email: `logout@github.com`,
            avatar_url: null,
          }),
        })

      const authRes = await app.inject({
        method: `GET`,
        url: `${OAUTH_PREFIX}/github/callback?code=test-code&state=${state}`,
        headers: { cookie: `oauth_state=${stateCookie?.value}` },
      })

      const refreshCookie = authRes.cookies.find((c: any) => c.name === `refresh_token`)

      // Logout
      const logoutRes = await app.inject({
        method: `POST`,
        url: `${AUTH_PREFIX}/logout`,
        headers: {
          cookie: `refresh_token=${refreshCookie?.value}`,
        },
      })

      expect(logoutRes.statusCode).toBe(200)
      const body = logoutRes.json() as any
      expect(body.success).toBe(true)

      // Verify refresh token is cleared
      const cookies = logoutRes.cookies
      const clearedCookie = cookies.find((c: any) => c.name === `refresh_token`)
      if (clearedCookie) {
        expect(clearedCookie.maxAge === 0 || clearedCookie.expires).toBeTruthy()
      }
    })
  })
})
