import fs from 'node:fs'
import dotenv from 'dotenv'

/** 优先加载 .env.server，否则 .env */
export function loadEnv() {
  if (fs.existsSync('.env.server')) {
    dotenv.config({ path: '.env.server' })
  } else {
    dotenv.config()
  }
}
