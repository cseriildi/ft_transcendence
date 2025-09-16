import { FastifyInstance } from "fastify";
import { ApiResponseHelper } from "../utils/responses.js";

async function checkRoutes(fastify: FastifyInstance) {

      fastify.get('/', async (request, reply) => {
    return ApiResponseHelper.success(
      { 
        message: 'Welcome to the API',
        version: '1.0.0'
      },
      'API is running'
    )
  })

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
}

export default checkRoutes