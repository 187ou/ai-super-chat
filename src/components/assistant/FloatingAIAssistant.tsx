import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bot, Minus, Send, Sparkles, Square, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Group } from 'three'
import { toast } from 'sonner'
import { streamChat } from '../../lib/ai'
import { getRecentAssistantContexts } from '../../lib/assistantContext'
import {
  getAssistantRouteLabel,
  matchAssistantNavigationIntent,
  shouldAssistantNavigateOnly,
} from '../../lib/assistantNavigation'
import { Textarea } from '../ui/textarea'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

type AssistantState = 'idle' | 'thinking' | 'speaking'
type Pos = { x: number; y: number }
const STORAGE_KEY = 'ai_dev_assistant_floating_ai_pos_v1'

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return true
  if (e instanceof Error && e.name === 'AbortError') return true
  return false
}

function routeName(pathname: string): string {
  return getAssistantRouteLabel(pathname)
}

function buildContextPrompt(pathname: string): string {
  const page = routeName(pathname)
  const recent = getRecentAssistantContexts(4)
  const recentText = recent.length
    ? recent.map((x, i) => `${i + 1}. [${x.source}] ${x.title} @${x.route}\n${x.content.slice(0, 320)}`).join('\n\n')
    : '暂无最近结果'

  return [
    '你是页面内全局助手。请优先结合当前页面语境，回答简洁可执行。',
    `当前页面：${page} (${pathname})`,
    '最近结果摘要：',
    recentText,
  ].join('\n')
}

function loadInitialPos(): Pos {
  if (typeof window === 'undefined') return { x: 24, y: 24 }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { x: 24, y: 24 }
    const p = JSON.parse(raw) as Partial<Pos>
    return {
      x: typeof p.x === 'number' ? p.x : 24,
      y: typeof p.y === 'number' ? p.y : 24,
    }
  } catch {
    return { x: 24, y: 24 }
  }
}

function AvatarMesh({ state }: { state: AssistantState }) {
  const groupRef = useRef<Group>(null)

  useFrame((ctx) => {
    const g = groupRef.current
    if (!g) return
    const t = ctx.clock.elapsedTime
    const amp = state === 'idle' ? 0.06 : state === 'thinking' ? 0.09 : 0.1
    const rot = state === 'speaking' ? 0.4 : state === 'thinking' ? 0.32 : 0.25
    g.rotation.y = Math.sin(t * 0.8) * rot
    g.position.y = Math.sin(t * 1.6) * amp
  })

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.38, 32, 32]} />
        <meshStandardMaterial color="#d4d4d8" metalness={0.35} roughness={0.2} />
      </mesh>
      <mesh position={[0, -0.35, 0]}>
        <capsuleGeometry args={[0.25, 0.5, 8, 16]} />
        <meshStandardMaterial color="#a1a1aa" metalness={0.2} roughness={0.45} />
      </mesh>
      <mesh position={[-0.13, 0.43, 0.33]}>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshStandardMaterial color="#18181b" />
      </mesh>
      <mesh position={[0.13, 0.43, 0.33]}>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshStandardMaterial color="#18181b" />
      </mesh>
      <mesh position={[0, 0.24, 0.33]}>
        <boxGeometry args={[0.16, 0.03, 0.03]} />
        <meshStandardMaterial color="#27272a" />
      </mesh>
    </group>
  )
}

export function FloatingAIAssistant() {
  const location = useLocation()
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [answer, setAnswer] = useState('你好，我是全局智能助手。你可以拖拽我，并随时提问。')
  const [loading, setLoading] = useState(false)
  const [assistantState, setAssistantState] = useState<AssistantState>('idle')
  const [pos, setPos] = useState<Pos>(() => loadInitialPos())
  const abortRef = useRef<AbortController | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null)
  const didDragRef = useRef(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const style = useMemo(
    () => ({
      right: `${Math.max(12, pos.x)}px`,
      bottom: `${Math.max(12, pos.y)}px`,
    }),
    [pos],
  )

  const clampPos = useCallback((next: Pos): Pos => {
    if (typeof window === 'undefined') return next
    const rect = rootRef.current?.getBoundingClientRect()
    const width = rect?.width ?? (expanded && !minimized ? 340 : 80)
    const height = rect?.height ?? (expanded && !minimized ? 360 : expanded ? 56 : 80)
    const maxX = Math.max(8, window.innerWidth - width - 8)
    const maxY = Math.max(8, window.innerHeight - height - 8)
    return {
      x: Math.min(maxX, Math.max(8, next.x)),
      y: Math.min(maxY, Math.max(8, next.y)),
    }
  }, [expanded, minimized])

  function persist(next: Pos) {
    const clamped = clampPos(next)
    setPos(clamped)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped))
    } catch {
      /* ignore */
    }
  }

  function onDragStart(e: ReactPointerEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement
    if (target.closest('[data-no-drag="true"]')) return
    didDragRef.current = false
    setIsDragging(true)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: pos.x,
      baseY: pos.y,
    }
    ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
  }

  function onDragMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current
    if (!d) return
    const dx = d.startX - e.clientX
    const dy = d.startY - e.clientY
    // 阈值稍大，避免点击时轻微手抖被误判成拖拽
    if (Math.abs(dx) + Math.abs(dy) > 8) didDragRef.current = true
    persist({
      x: Math.max(8, d.baseX + dx),
      y: Math.max(8, d.baseY + dy),
    })
  }

  function onDragEnd(openWhenTap: boolean) {
    setIsDragging(false)
    const dragged = didDragRef.current
    dragRef.current = null
    if (openWhenTap && !expanded && !dragged) {
      setExpanded(true)
      setMinimized(false)
    }
    didDragRef.current = false
  }

  useEffect(() => {
    const onResize = () => {
      setPos((prev) => clampPos(prev))
    }
    window.addEventListener('resize', onResize)
    onResize()
    return () => window.removeEventListener('resize', onResize)
  }, [expanded, minimized])

  async function askAssistant() {
    if (loading) return
    const q = prompt.trim()
    if (!q) return

    const navIntent = matchAssistantNavigationIntent(q)
    if (navIntent) {
      const alreadyThere = location.pathname === navIntent.path
      if (!alreadyThere) {
        navigate(navIntent.path)
        toast.success(`已打开「${navIntent.label}」`)
      } else {
        toast.message(`当前已在「${navIntent.label}」页面`)
      }

      if (shouldAssistantNavigateOnly(q)) {
        setPrompt('')
        setAnswer(
          alreadyThere
            ? `当前已是「${navIntent.label}」页面，可直接使用页面功能或继续提问。`
            : `已为您切换到「${navIntent.label}」页面，左侧导航已同步。可直接使用该页功能，或继续向我提问。`,
        )
        return
      }
    }

    const ac = new AbortController()
    abortRef.current = ac
    setLoading(true)
    setAssistantState('thinking')
    setAnswer('')
    const pathForContext = navIntent?.path ?? location.pathname
    const navNote = navIntent
      ? `用户已请求打开「${navIntent.label}」页面，请结合该页面能力回答。\n`
      : ''
    const enrichedPrompt = `${buildContextPrompt(pathForContext)}\n${navNote}\n用户问题：${q}`
    try {
      let out = ''
      for await (const chunk of streamChat({ prompt: enrichedPrompt, history: [], signal: ac.signal })) {
        out += chunk
        setAnswer(out)
      }
      /* streamChat 在请求失败时不抛错，而是流式输出降级文案（见 lib/ai.ts），此处单独提示便于排查 */
      if (out.includes('实时 AI 请求失败')) {
        toast.error('无法连接 AI 服务', {
          description: '请确认已启动后端代理（如 pnpm dev:server），并在 .env.server 配置 TONGYI_API_KEY；浏览器访问 http://localhost:8787/health 应返回 ok。',
        })
      }
      setAssistantState('idle')
    } catch (e) {
      if (isAbortError(e)) toast.message('已停止回答')
      else {
        const msg = e instanceof Error ? e.message : '未知异常'
        toast.error(`助手请求失败：${msg}`)
      }
      setAssistantState('idle')
    } finally {
      abortRef.current = null
      setLoading(false)
    }
  }

  return (
    <div
      ref={rootRef}
      className={cn('fixed z-[120] select-none', isDragging ? 'cursor-grabbing' : 'cursor-grab')}
      style={style}
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={() => onDragEnd(true)}
      onPointerCancel={() => onDragEnd(false)}
    >
      {!expanded ? (
        <button
          type="button"
          className={cn(
            'group relative h-20 w-20 rounded-2xl border border-zinc-200/80 bg-white/85 p-0 shadow-xl backdrop-blur dark:border-zinc-700/70 dark:bg-zinc-900/80',
            isDragging ? 'cursor-grabbing' : 'cursor-grab',
          )}
          onClick={(e) => e.preventDefault()}
          title="打开智能助手（可拖动）"
        >
          <div className="h-full w-full overflow-hidden rounded-xl">
            <Canvas camera={{ position: [0, 0, 2.5], fov: 45 }}>
              <ambientLight intensity={0.75} />
              <directionalLight position={[2, 2, 2]} intensity={1} />
              <AvatarMesh state={assistantState} />
            </Canvas>
          </div>
          <div className="pointer-events-none absolute -right-1 -top-1 rounded-full bg-zinc-900 p-1 text-white dark:bg-white dark:text-zinc-900">
            <Sparkles className="h-3 w-3" />
          </div>
        </button>
      ) : (
        <div
          className={`w-[340px] overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/95 shadow-2xl backdrop-blur dark:border-zinc-700/70 dark:bg-zinc-900/95 ${minimized ? 'h-14' : ''}`}
        >
          <div className="flex cursor-grab items-center justify-between border-b border-zinc-200/70 px-3 py-2 active:cursor-grabbing dark:border-zinc-700/60">
            <div className="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-200">
              <Bot className="h-4 w-4" />
              全局智能助手 · {assistantState === 'thinking' ? '思考中' : assistantState === 'speaking' ? '播报中' : '待机'}
            </div>
            <div className="flex shrink-0 cursor-default items-center gap-1" data-no-drag="true">
              <button
                type="button"
                className="cursor-pointer rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                onClick={() => setMinimized((v) => !v)}
                title={minimized ? '展开' : '最小化'}
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="cursor-pointer rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                onClick={() => setExpanded(false)}
                title="关闭"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {!minimized && (
            <div className="cursor-auto p-3" data-no-drag="true">
              <div className="mb-2 h-24 overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50/60 dark:border-zinc-700/60 dark:bg-zinc-950/40">
                <Canvas camera={{ position: [0, 0, 2.4], fov: 44 }}>
                  <ambientLight intensity={0.75} />
                  <directionalLight position={[2, 2, 2]} intensity={1} />
                  <AvatarMesh state={assistantState} />
                </Canvas>
              </div>
              <div className="max-h-36 overflow-auto rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-2 text-xs leading-relaxed text-zinc-700 dark:border-zinc-700/60 dark:bg-zinc-950/40 dark:text-zinc-200">
                {loading ? `${answer}\n\n...` : answer}
              </div>
              <div className="relative mt-2">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
                    e.preventDefault()
                    void askAssistant()
                  }}
                  className="min-h-[72px] max-h-[120px] resize-none overflow-y-auto pr-[112px]"
                  placeholder={`输入问题（${routeName(location.pathname)}）`}
                  disabled={loading}
                />
                <div className="absolute bottom-2 right-2 flex items-center gap-1">
                  {loading ? (
                    <Button
                      type="button"
                      size="sm"
                      intent="outline"
                      className="h-8 px-2"
                      onClick={() => abortRef.current?.abort()}
                      title="停止回答"
                    >
                      <Square className="h-3.5 w-3.5 fill-current" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 px-2.5"
                      onClick={() => void askAssistant()}
                      disabled={!prompt.trim()}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

