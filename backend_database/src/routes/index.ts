import { FastifyInstance } from 'fastify'
import userRoutes from './users.ts'
import { ApiResponseHelper } from '../utils/responses'

async function routes(fastify: FastifyInstance) {
  // Root endpoint
  fastify.get('/', async (request, reply) => {
    return ApiResponseHelper.success(
      { 
        message: 'Welcome to the API',
        version: '1.0.0'
      },
      'API is running'
    )
  })

  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    return ApiResponseHelper.success(
      { 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      },
      'Service is healthy'
    )
  })

  // Register user routes
  await fastify.register(userRoutes)
}

export default routes
