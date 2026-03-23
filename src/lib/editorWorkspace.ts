import { uid } from './utils'

export type EditorFile = {
  id: string
  path: string
  content: string
}

export type HistorySnapshot = {
  id: string
  at: number
  label: string
  /** 快照时各文件完整内容 */
  files: EditorFile[]
}

const STORAGE_KEY = 'ai_dev_online_editor_v1'
const MAX_HISTORY = 40

const defaultFiles: EditorFile[] = [
  {
    id: 'f1',
    path: '/src/App.tsx',
    content: `import { useState } from 'react'

export default function App() {
  const [n, setN] = useState(0)
  return (
    <main className="p-4">
      <h1 className="text-lg font-semibold">在线编辑器</h1>
      <p className="mt-2 text-sm text-zinc-600">计数：{n}</p>
      <button
        type="button"
        className="mt-2 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white"
        onClick={() => setN((x) => x + 1)}
      >
        +1
      </button>
    </main>
  )
}
`,
  },
  {
    id: 'f2',
    path: '/src/types.ts',
    content: `export type User = {
  id: string
  name: string
}
`,
  },
]

export type WorkspaceState = {
  files: EditorFile[]
  activeId: string
  history: HistorySnapshot[]
}

export function defaultWorkspace(): WorkspaceState {
  const files = defaultFiles.map((f) => ({ ...f, id: uid('file') }))
  return {
    files,
    activeId: files[0]?.id ?? '',
    history: [],
  }
}

function normalizeLoaded(raw: unknown): WorkspaceState | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!Array.isArray(o.files)) return null
  const files: EditorFile[] = []
  for (const item of o.files) {
    if (!item || typeof item !== 'object') continue
    const f = item as Record<string, unknown>
    if (typeof f.id !== 'string' || typeof f.path !== 'string' || typeof f.content !== 'string') continue
    files.push({ id: f.id, path: f.path, content: f.content })
  }
  if (files.length === 0) return null
  let activeId = typeof o.activeId === 'string' ? o.activeId : files[0].id
  if (!files.some((f) => f.id === activeId)) activeId = files[0].id

  const history: HistorySnapshot[] = []
  if (Array.isArray(o.history)) {
    for (const h of o.history) {
      if (!h || typeof h !== 'object') continue
      const hi = h as Record<string, unknown>
      if (typeof hi.id !== 'string' || typeof hi.at !== 'number' || typeof hi.label !== 'string') continue
      if (!Array.isArray(hi.files)) continue
      const snapFiles: EditorFile[] = []
      for (const sf of hi.files) {
        if (!sf || typeof sf !== 'object') continue
        const s = sf as Record<string, unknown>
        if (typeof s.id !== 'string' || typeof s.path !== 'string' || typeof s.content !== 'string') continue
        snapFiles.push({ id: s.id, path: s.path, content: s.content })
      }
      if (snapFiles.length) history.push({ id: hi.id, at: hi.at, label: hi.label, files: snapFiles })
    }
  }

  return { files, activeId, history: history.slice(-MAX_HISTORY) }
}

export function loadWorkspace(): WorkspaceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return defaultWorkspace()
    }
    const parsed = normalizeLoaded(JSON.parse(raw))
    if (parsed) return parsed
  } catch {
    /* ignore */
  }
  return defaultWorkspace()
}

export function persistWorkspace(state: WorkspaceState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* quota */
  }
}

/**
 * 重置在线编辑器工作区为默认示例文件。
 * 用于「个人中心」一键清空本地数据。
 */
export function resetWorkspaceToDefault(): WorkspaceState {
  const next = defaultWorkspace()
  persistWorkspace(next)
  return next
}

export function languageFromPath(path: string): string {
  const p = path.toLowerCase()
  if (p.endsWith('.tsx') || p.endsWith('.ts')) return 'typescript'
  if (p.endsWith('.jsx') || p.endsWith('.js')) return 'javascript'
  if (p.endsWith('.json')) return 'json'
  if (p.endsWith('.css')) return 'css'
  if (p.endsWith('.html')) return 'html'
  return 'typescript'
}

let untitledSeq = 1
export function nextUntitledPath(ext = 'tsx'): string {
  const n = untitledSeq++
  return `/src/untitled-${n}.${ext}`
}

export function pushHistory(
  history: HistorySnapshot[],
  label: string,
  files: EditorFile[],
): HistorySnapshot[] {
  const snap: HistorySnapshot = {
    id: uid('hist'),
    at: Date.now(),
    label,
    files: files.map((f) => ({ ...f })),
  }
  return [...history, snap].slice(-MAX_HISTORY)
}

function guessGeneratedExt(code: string): 'tsx' | 'ts' {
  const sample = code.slice(0, 600)
  if (/<[A-Za-z][^>]*>/.test(sample) || /return\s*\(\s*</.test(sample)) return 'tsx'
  return 'ts'
}

/**
 * 将代码生成结果写入在线编辑器工作区，并切换到该文件。
 * 若同路径已存在则覆盖其内容，不重复创建。
 */
export function upsertGeneratedCodeToWorkspace(
  code: string,
  baseName = 'codegen-result',
): WorkspaceState {
  const ws = loadWorkspace()
  const ext = guessGeneratedExt(code)
  const path = `/src/${baseName}.${ext}`
  const content = code.trim() || 'export {}\n'

  const idx = ws.files.findIndex((f) => f.path === path)
  if (idx >= 0) {
    const id = ws.files[idx].id
    const files = ws.files.map((f, i) => (i === idx ? { ...f, content } : f))
    const next: WorkspaceState = { ...ws, files, activeId: id }
    persistWorkspace(next)
    return next
  }

  const file: EditorFile = { id: uid('file'), path, content }
  const next: WorkspaceState = {
    ...ws,
    files: [...ws.files, file],
    activeId: file.id,
  }
  persistWorkspace(next)
  return next
}

/**
 * 多方案代码：每个代码块单独写入一个文件（baseName-1 / -2 ...），并激活第一个。
 */
export function upsertGeneratedCodeBlocksToWorkspace(
  blocks: string[],
  baseName = 'codegen-result',
): WorkspaceState {
  if (!blocks.length) return loadWorkspace()

  const ws = loadWorkspace()
  const files = [...ws.files]
  let firstId = ''

  for (let i = 0; i < blocks.length; i += 1) {
    const raw = blocks[i] ?? ''
    const content = raw.trim() || 'export {}\n'
    const ext = guessGeneratedExt(content)
    const path = `/src/${baseName}-${i + 1}.${ext}`

    const idx = files.findIndex((f) => f.path === path)
    if (idx >= 0) {
      const id = files[idx].id
      files[idx] = { ...files[idx], content }
      if (!firstId) firstId = id
      continue
    }

    const file: EditorFile = { id: uid('file'), path, content }
    files.push(file)
    if (!firstId) firstId = file.id
  }

  const next: WorkspaceState = {
    ...ws,
    files,
    activeId: firstId || ws.activeId,
  }
  persistWorkspace(next)
  return next
}
