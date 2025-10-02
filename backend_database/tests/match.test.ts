import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest'
import { FastifyInstance } from 'fastify'
import { createTestApp, cleanupTestApp, resetDatabase } from './setup'

describe('Match Routes', () => {
  let app: FastifyInstance
  let user1: { id: number; username: string }
  let user2: { id: number; username: string }

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await cleanupTestApp(app)
  })

  beforeEach(async () => {
    await resetDatabase(app)
    
    // Create two test users
    const res1 = await app.inject({
      method: 'POST',
      url: '/register',
      payload: {
        username: 'player1',
        email: 'player1@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      }
    })
    const body1 = res1.json() as any
    user1 = { id: body1.data.id, username: body1.data.username }

    const res2 = await app.inject({
      method: 'POST',
      url: '/register',
      payload: {
        username: 'player2',
        email: 'player2@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      }
    })
    const body2 = res2.json() as any
    user2 = { id: body2.data.id, username: body2.data.username }
  })

  it('POST /matches should create a match', async () => {
    const payload = {
      winner: user1.username,
      loser: user2.username,
      winner_score: 21,
      loser_score: 15,
    }

    const res = await app.inject({
      method: 'POST',
      url: '/matches',
      payload,
    })

    expect(res.statusCode).toBe(201)
    const body = res.json() as any
    expect(body.success).toBe(true)
    expect(body.data?.winner).toBe(user1.username)
    expect(body.data?.loser).toBe(user2.username)
    expect(body.data?.winner_score).toBe(21)
    expect(body.data?.loser_score).toBe(15)
    expect(body.data).toHaveProperty('id')
    expect(body.data).toHaveProperty('played_at')
  })

  it('POST /matches should validate required fields', async () => {
    const payload = {
      winner: user1.username,
      // missing loser, scores
    }

    const res = await app.inject({
      method: 'POST',
      url: '/matches',
      payload,
    })

    expect(res.statusCode).toBe(400)
    const body = res.json() as any
    expect(body.success).toBe(false)
  })

  it('POST /matches should validate winner exists', async () => {
    const payload = {
      winner: 'nonexistent',
      loser: user2.username,
      winner_score: 21,
      loser_score: 15,
    }

    const res = await app.inject({
      method: 'POST',
      url: '/matches',
      payload,
    })

    expect(res.statusCode).toBe(404)
    const body = res.json() as any
    expect(body.success).toBe(false)
  })

  it('POST /matches should validate loser exists', async () => {
    const payload = {
      winner: user1.username,
      loser: 'nonexistent',
      winner_score: 21,
      loser_score: 15,
    }

    const res = await app.inject({
      method: 'POST',
      url: '/matches',
      payload,
    })

    expect(res.statusCode).toBe(404)
    const body = res.json() as any
    expect(body.success).toBe(false)
  })

  it('POST /matches should validate scores are positive', async () => {
    const payload = {
      winner: user1.username,
      loser: user2.username,
      winner_score: -5,
      loser_score: 15,
    }

    const res = await app.inject({
      method: 'POST',
      url: '/matches',
      payload,
    })

    expect(res.statusCode).toBe(400)
    const body = res.json() as any
    expect(body.success).toBe(false)
  })

  it('GET /matches/:username should return user matches', async () => {
    // Create some matches
    await app.inject({
      method: 'POST',
      url: '/matches',
      payload: {
        winner: user1.username,
        loser: user2.username,
        winner_score: 21,
        loser_score: 15,
      }
    })

    await app.inject({
      method: 'POST',
      url: '/matches',
      payload: {
        winner: user2.username,
        loser: user1.username,
        winner_score: 21,
        loser_score: 18,
      }
    })

    const res = await app.inject({
      method: 'GET',
      url: `/matches/${user1.username}`,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json() as any
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBe(2)
    
    // Check that matches include user1
    body.data.forEach((match: any) => {
      expect(
        match.winner === user1.username || match.loser === user1.username
      ).toBe(true)
    })
  })

  it('GET /matches/:username should return empty array for no matches', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/matches/${user1.username}`,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json() as any
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBe(0)
  })

  it('GET /matches/:username should return 404 for non-existent user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/matches/nonexistentuser',
    })

    expect(res.statusCode).toBe(404)
    const body = res.json() as any
    expect(body.success).toBe(false)
  })

  it('GET /matches/:username should order matches by date (newest first)', async () => {
    // Create matches with slight delay
    await app.inject({
      method: 'POST',
      url: '/matches',
      payload: {
        winner: user1.username,
        loser: user2.username,
        winner_score: 21,
        loser_score: 15,
      }
    })

    await new Promise(resolve => setTimeout(resolve, 10))

    await app.inject({
      method: 'POST',
      url: '/matches',
      payload: {
        winner: user2.username,
        loser: user1.username,
        winner_score: 21,
        loser_score: 18,
      }
    })

    const res = await app.inject({
      method: 'GET',
      url: `/matches/${user1.username}`,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json() as any
    expect(body.data.length).toBe(2)
    
    // Verify newest is first
    const firstMatchDate = new Date(body.data[0].played_at)
    const secondMatchDate = new Date(body.data[1].played_at)
    expect(firstMatchDate.getTime()).toBeGreaterThanOrEqual(secondMatchDate.getTime())
  })

  it('POST /matches should handle same player winning/losing multiple times', async () => {
    // Player1 wins twice
    await app.inject({
      method: 'POST',
      url: '/matches',
      payload: {
        winner: user1.username,
        loser: user2.username,
        winner_score: 21,
        loser_score: 15,
      }
    })

    await app.inject({
      method: 'POST',
      url: '/matches',
      payload: {
        winner: user1.username,
        loser: user2.username,
        winner_score: 21,
        loser_score: 10,
      }
    })

    const res = await app.inject({
      method: 'GET',
      url: `/matches/${user1.username}`,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json() as any
    expect(body.data.length).toBe(2)
    body.data.forEach((match: any) => {
      expect(match.winner).toBe(user1.username)
      expect(match.loser).toBe(user2.username)
    })
  })
})
