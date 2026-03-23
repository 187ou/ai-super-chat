import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STORAGE_DIR = path.join(__dirname, 'storage', 'kbs')

async function ensureDir() {
  await fs.mkdir(STORAGE_DIR, { recursive: true })
}

function kbPath(kbId) {
  return path.join(STORAGE_DIR, `${kbId}.json`)
}

export async function createKb({ name = '', chunks = [] }) {
  await ensureDir()
  const id = randomUUID()
  const kb = {
    id,
    name,
    createdAt: Date.now(),
    chunkCount: chunks.length,
    chunks,
  }
  await fs.writeFile(kbPath(id), JSON.stringify(kb), 'utf-8')
  return kb
}

export async function loadKb(kbId) {
  await ensureDir()
  const file = kbPath(kbId)
  const raw = await fs.readFile(file, 'utf-8')
  return JSON.parse(raw)
}

export async function deleteKb(kbId) {
  await ensureDir()
  const file = kbPath(kbId)
  await fs.unlink(file).catch(() => {})
}

