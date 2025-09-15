import Fastify from 'fastify'
import firstRoute from './routes.ts'
import dbConnector from './database.ts'

const fastify = Fastify({
  logger: true
})


const start = async () => {
  try {
    await fastify.register(dbConnector,{path: './src/database/database.db'})
    await fastify.register(firstRoute)
    await fastify.listen({ port: 3000, host: '::'}) 
  } 
  catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()