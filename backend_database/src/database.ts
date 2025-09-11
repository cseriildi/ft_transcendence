import sqlite3 from "sqlite3"

async function dbConnector (fastify, options) {

    const dbPath = options.path || './database/database.db';
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      fastify.log.error('Could not connect to database', err)
    } else {
      fastify.log.info('Connected to database')
    }
  })

  // Initialize database schema
  const initDb = () => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Create tables here
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            fastify.log.error('Error creating users table:', err)
            reject(err)
          }
        })

        db.run(`
          CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
          )
        `, (err) => {
          if (err) {
            fastify.log.error('Error creating posts table:', err)
            reject(err)
          } else {
            fastify.log.info('Database schema initialized')
            resolve(undefined)
          }
        })
      })
    })
  }

  // Initialize the database
  await initDb()

  fastify.decorate('db', db)
}

// and hooks, declared inside the plugin to the parent scope.
export default dbConnector;