import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Bot,
  Bug,
  ChartSpline,
  ChevronRight,
  Code2,
  Compass,
  FileCode2,
  FileText,
  Home,
  Image,
  Moon,
  PanelLeftClose,
  Sparkles,
  Sun,
  User,
} from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'
import { FloatingAIAssistant } from '../assistant/FloatingAIAssistant'

const navItems = [
  { to: '/', label: '工作台', icon: Home },
  { to: '/chat', label: 'AI 聊天', icon: Bot },
  { to: '/content-production', label: '内容生产', icon: FileText },
  { to: '/codegen', label: '代码生成', icon: FileCode2 },
  { to: '/editor', label: '在线编辑器', icon: Code2 },
  { to: '/apidoc', label: '接口文档', icon: FileText },
  { to: '/charts', label: '可视化', icon: ChartSpline },
  { to: '/intelligent-analysis', label: '智能预测分析', icon: Compass },
  { to: '/debug', label: '调试修复', icon: Bug },
  { to: '/multimodal', label: '多模态', icon: Image },
  { to: '/rag', label: '知识库检索', icon: FileText },
  { to: '/profile', label: '个人中心', icon: User },
]

const SIDEBAR_STORAGE_KEY = 'ai_dev_assistant_sidebar_collapsed'

/** 与 AI 聊天一致：主区全宽、无 padding */
const EDGE_TO_EDGE_PATHS = [
  '/',
  '/chat',
  '/content-production',
  '/codegen',
  '/editor',
  '/apidoc',
  '/charts',
  '/intelligent-analysis',
  '/debug',
  '/multimodal',
  '/rag',
  '/profile',
]

export function AppLayout() {
  const { darkMode, setDarkMode } = useTheme()
  const location = useLocation()
  const isEdgeToEdgePage = EDGE_TO_EDGE_PATHS.includes(location.pathname)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1'
  })

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarCollapsed ? '1' : '0')
  }, [sidebarCollapsed])

  return (
    <div className="app-shell relative flex h-screen min-h-0 max-h-screen w-full flex-col overflow-hidden text-zinc-900 dark:text-zinc-100 md:flex-row">
      <aside
        className={cn(
          'flex max-h-[42vh] min-h-0 w-full shrink-0 flex-col overflow-y-auto border-b border-zinc-200/80 bg-white/75 backdrop-blur-xl transition-[width] duration-200 ease-out dark:border-zinc-700/50 dark:bg-zinc-800',
          'md:max-h-none md:h-full md:border-b-0 md:border-r',
          sidebarCollapsed ? 'md:w-[72px]' : 'md:w-[260px]',
        )}
      >
        {/* 品牌区：展开显示标题；收起仅 Logo + 展开按钮 */}
        <div
          className={cn(
            'flex shrink-0 border-b border-zinc-200/60 dark:border-zinc-800/60',
            sidebarCollapsed
              ? 'flex-col items-center gap-2 px-2 py-4 md:py-5'
              : 'items-center gap-3 px-5 py-5',
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900">
            <Sparkles className="h-5 w-5" strokeWidth={1.75} />
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold tracking-wide text-zinc-900 dark:text-zinc-50">
                AI Developer
              </p>
              <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                Assistant
              </p>
            </div>
          )}
          {!sidebarCollapsed && (
            <button
              type="button"
              aria-label="收起侧栏"
              className="hidden shrink-0 rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/90 dark:hover:text-zinc-200 md:flex md:items-center md:justify-center"
              onClick={() => setSidebarCollapsed(true)}
            >
              <PanelLeftClose className="h-5 w-5" strokeWidth={1.75} />
            </button>
          )}
          {sidebarCollapsed && (
            <button
              type="button"
              aria-label="展开侧栏"
              className="hidden rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/90 dark:hover:text-zinc-200 md:flex md:items-center md:justify-center"
              onClick={() => setSidebarCollapsed(false)}
            >
              <ChevronRight className="h-5 w-5" strokeWidth={1.75} />
            </button>
          )}
        </div>

        <nav
          className={cn(
            'flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-3',
            sidebarCollapsed && 'md:items-center md:px-2',
          )}
        >
          <p
            className={cn(
              'shrink-0 px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-400',
              sidebarCollapsed && 'md:sr-only',
            )}
          >
            导航
          </p>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center rounded-xl text-[13px] font-medium transition-colors',
                  sidebarCollapsed ? 'justify-center px-2 py-2.5 md:aspect-square md:w-10 md:max-w-none md:p-0' : 'gap-3 px-3 py-2.5',
                  isActive
                    ? 'bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900'
                    : 'text-zinc-600 hover:bg-zinc-100/90 dark:text-zinc-300 dark:hover:bg-zinc-800/90',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'opacity-100' : 'opacity-70')}
                    strokeWidth={1.75}
                  />
                  <span className={cn('truncate', sidebarCollapsed && 'md:sr-only')}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div
          className={cn(
            'shrink-0 border-t border-zinc-200/60 p-3 dark:border-zinc-800/60',
            sidebarCollapsed && 'md:flex md:justify-center',
          )}
        >
          <Button
            className={cn(
              'w-full gap-2 rounded-xl border-zinc-200/90 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200',
              sidebarCollapsed && 'md:h-10 md:w-10 md:max-w-none md:justify-center md:p-0',
            )}
            intent="outline"
            type="button"
            title={darkMode ? '切换为浅色' : '切换为深色'}
            onClick={() => setDarkMode(!darkMode)}
          >
            {darkMode ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
            <span className={cn(sidebarCollapsed && 'md:sr-only')}>{darkMode ? '亮色模式' : '浅色模式'}</span>
          </Button>
        </div>
      </aside>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent text-zinc-900 dark:text-zinc-100">
        <div
          className={cn(
            'mx-auto flex min-h-0 w-full flex-1 flex-col overflow-y-auto overflow-x-hidden transition-[max-width,padding] duration-200 ease-out',
            isEdgeToEdgePage ? 'max-w-none p-0' : 'px-6 py-10 md:px-10 md:py-12 lg:px-12',
            !isEdgeToEdgePage && (sidebarCollapsed ? 'max-w-7xl' : 'max-w-6xl'),
          )}
        >
          <Outlet />
        </div>
      </main>
      <FloatingAIAssistant />
    </div>
  )
}
