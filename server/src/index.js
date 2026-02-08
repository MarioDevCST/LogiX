import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import usersRouter from './routes/users.js'
import companiesRouter from './routes/companies.js'
import shipsRouter from './routes/ships.js'
import palletsRouter from './routes/pallets.js'
import loadsRouter from './routes/loads.js'
import locationsRouter from './routes/locations.js'

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 5000
const MONGO_URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB || 'logix'

// Conexión a MongoDB
async function start() {
  try {
    if (!MONGO_URI) throw new Error('MONGODB_URI no definido en .env')
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME })
    console.log('Conectado a MongoDB', { dbName: DB_NAME })

    app.get('/api/health', (req, res) => {
      res.json({ ok: true, service: 'logix-api', mongo: mongoose.connection.readyState === 1, db: DB_NAME })
    })

    app.use('/api/users', usersRouter)
    app.use('/api/companies', companiesRouter)
    app.use('/api/ships', shipsRouter)
    app.use('/api/pallets', palletsRouter)
    app.use('/api/loads', loadsRouter)
    app.use('/api/locations', locationsRouter)

    app.listen(PORT, () => console.log(`API escuchando en http://localhost:${PORT}`))
  } catch (err) {
    console.error('Error iniciando el servidor:', err.message)
    process.exit(1)
  }
}

start()