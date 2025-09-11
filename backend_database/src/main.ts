import Fastify, { FastifyRequest } from 'fastify'
import firstRoute from './routes.ts'
import dbConnector from './database.ts'
import { optional } from 'zod'

const fastify = Fastify({
  logger: true
})

fastify.register(firstRoute)
fastify.register(dbConnector,{path: './database/database.db'}  ) 

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '::'}) 
  } 
  catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()