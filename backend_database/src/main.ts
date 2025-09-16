import fastify from 'fastify'
import routes from './routes/index.ts'
import dbConnector from './database.ts'
import { config, validateConfig } from './config.ts'
import errorHandler from './plugins/errorHandler.ts'

// Validate configuration on startup
validateConfig()

const app = fastify({
  logger: {
    level: config.logging.level
  }
})


const start = async () => {
  try {
    await app.register(errorHandler) 
    await app.register(dbConnector, { path: config.database.path })
    await app.register(routes)
    await app.listen({ port: config.server.port, host: config.server.host }) 
    
    app.log.info(`Server running in ${config.server.env} mode`)
    app.log.info(`Database: ${config.database.path}`)
  } 
  catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()