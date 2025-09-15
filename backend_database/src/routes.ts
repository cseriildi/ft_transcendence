import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { CreateUserBody, UserParams, CreateUserResponse, GetUserResponse, GetUsersResponse, ErrorResponse } from './types/users.ts'
import './types/fastify.ts' // Import Fastify type extensions


async function routes (fastify : FastifyInstance, options) {
  fastify.get('/', async (request, reply) => {
    return { hello: 'world' }
  })

   fastify.post<{ 
     Body: CreateUserBody
     Reply: CreateUserResponse | ErrorResponse 
   }>('/users', async (request, reply) => {
    const { username, email } = request.body

    // Validate input
    if (!username || !email) {
      reply.status(400)
      return { error: 'Username and email are required' }
    }

    // Insert user into database
    return new Promise((resolve, reject) => {
      fastify.db.run(
        'INSERT INTO users (username, email) VALUES (?, ?)',
        [username, email],
        function(err) {
          if (err) {
            fastify.log.error('Error creating user:', err)
            
            // Check if it's a unique constraint error
            if (err.message.includes('UNIQUE constraint failed')) {
              reply.status(409)
              resolve({ error: 'Username or email already exists' })
            } else {
              reply.status(500)
              resolve({ error: 'Failed to create user' })
            }
          } else {
            reply.status(201)
            resolve({
              message: 'User created successfully',
              user: {
                id: this.lastID,
                username,
                email
              }
            })
          }
        }
      )
    })
  })

  // GET /users/:id - Get single user
  fastify.get<{ 
    Params: UserParams
    Reply: GetUserResponse | ErrorResponse 
  }>('/users/:id', async (request, reply) => {
    const { id } = request.params

    return new Promise((resolve, reject) => {
      fastify.db.get(
        'SELECT id, username, email, created_at FROM users WHERE id = ?',
        [id],
        (err, row) => {
          if (err) {
            fastify.log.error('Error fetching user:', err)
            reply.status(500)
            resolve({ error: 'Failed to fetch user' })
          } else if (!row) {
            reply.status(404)
            resolve({ error: 'User not found' })
          } else {
            resolve({ user: row })
          }
        }
      )
    })
  })

  // Optional: Get all users route
  fastify.get('/users', async (request, reply) => {
    return new Promise((resolve, reject) => {
      fastify.db.all('SELECT id, username, email, created_at FROM users', (err, rows) => {
        if (err) {
          fastify.log.error('Error fetching users:', err)
          reply.status(500)
          resolve({ error: 'Failed to fetch users' })
        } else {
          resolve({ users: rows })
        }
      })
    })
  })
}

//ESM
export default routes;