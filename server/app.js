import express from 'express'
import cors from 'cors'
import { registerRoutes } from './routes/index.js'

export function createApp() {
  const app = express()

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    }),
  )
  app.use(express.json({ limit: '12mb' }))

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'ai-proxy' })
  })

  registerRoutes(app)

  return app
}
