// src/routes/users.ts
import { FastifyInstance } from 'fastify'
import { 
  User,
  CreateUserBody, 
  UserParams, 
  CreateUserResponse,
  GetUserResponse,
  GetUsersResponse,
  UserErrorResponse
} from '../types/users.ts'
import { ApiResponseHelper } from '../utils/responses.ts'
import { errors } from '../utils/errors.ts'
import '../types/fastify.ts'

async function userRoutes(fastify: FastifyInstance) {
  
  // POST /users
  fastify.post<{ 
    Body: CreateUserBody
    Reply: CreateUserResponse | UserErrorResponse 
  }>('/users', async (request, reply) => {
    const { username, email } = request.body

    // Simple validation
    if (!username?.trim() || !email?.trim()) {
      throw errors.validation('Username and email are required')
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      throw errors.validation('Invalid email format')
    }

    // Direct database call
    const result = await new Promise<{ lastID: number, changes: number }>((resolve, reject) => {
      fastify.db.run(
        'INSERT INTO users (username, email) VALUES (?, ?)',
        [username.trim(), email.trim()],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint')) {
              reject(errors.conflict('Username or email already exists'))
            } else {
              reject(errors.internal('Database error'))
            }
          } else {
            resolve({ lastID: this.lastID, changes: this.changes })
          }
        }
      )
    })

    reply.status(201)
    return ApiResponseHelper.success({
      id: result.lastID,
      username: username.trim(),
      email: email.trim(),
      created_at: new Date().toISOString()
    }, 'User created')
  })

  // GET /users/:id
  fastify.get<{ 
    Params: UserParams
    Reply: GetUserResponse | UserErrorResponse 
  }>('/users/:id', async (request, reply) => {
    const { id } = request.params
    
    // Direct database call
    const user = await new Promise<User | null>((resolve, reject) => {
      fastify.db.get(
        'SELECT id, username, email, created_at FROM users WHERE id = ?',
        [id],
        (err: Error | null, row: User | undefined) => {
          if (err) {
            reject(errors.internal('Database error'))
          } else {
            resolve(row || null)
          }
        }
      )
    })

    if (!user) {
      throw errors.notFound('User')
    }

    return ApiResponseHelper.success(user, 'User found')
  })

  // GET /users
  fastify.get<{
    Reply: GetUsersResponse | UserErrorResponse
  }>('/users', async (request, reply) => {
    // Direct database call
    const users = await new Promise<User[]>((resolve, reject) => {
      fastify.db.all(
        'SELECT id, username, email, created_at FROM users ORDER BY created_at DESC',
        [],
        (err: Error | null, rows: User[]) => {
          if (err) {
            reject(errors.internal('Database error'))
          } else {
            resolve(rows || [])
          }
        }
      )
    })

    return ApiResponseHelper.success(users, 'Users retrieved')
  })
}

export default userRoutes