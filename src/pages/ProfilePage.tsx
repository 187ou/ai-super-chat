import { useActionState, useMemo, useState } from 'react'
import { User } from 'lucide-react'
import { featureScrollBodyClass, PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { getConversations, getSettings, setConversations, setSettings } from '../lib/storage'
import { loadWorkspace, resetWorkspaceToDefault } from '../lib/editorWorkspace'
import { toast } from 'sonner'

async function saveSettingsAction(_state: string, formData: FormData): Promise<string> {
  const current = getSettings()
  const next = {
    ...current,
    model: String(formData.get('model') ?? current.model),
    mockMode: formData.get('mockMode') === 'on',
    authRequired: formData.get('authRequired') === 'on',
  }
  setSettings(next)
  return '设置已保存'
}

export default function ProfilePage() {
  const current = getSettings()
  const [state, action, pending] = useActionState(saveSettingsAction, '')
  const [guardPassed, setGuardPassed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('ai_dev_assistant_passed') === '1'
  })

  const localCounts = useMemo(() => {
    try {
      const convCount = getConversations().length
      const ws = loadWorkspace()
      return {
        convCount,
        fileCount: ws.files.length,
        snapshotCount: ws.history.length,
      }
    } catch {
      return { convCount: 0, fileCount: 0, snapshotCount: 0 }
    }
  }, [])

  function markGuardPassed() {
    localStorage.setItem('ai_dev_assistant_passed', '1')
    setGuardPassed(true)
    toast.success('已标记：本机通过路由守卫')
  }

  function clearGuardPassed() {
    localStorage.removeItem('ai_dev_assistant_passed')
    setGuardPassed(false)
    toast.success('已取消：本机通过路由守卫标记')
  }

  function clearLocalConversations() {
    if (!window.confirm('确定清空本地对话记录？此操作不可撤销。')) return
    setConversations([])
    toast.success('已清空本地对话记录')
  }

  function resetEditorWorkspace() {
    if (!window.confirm('确定重置在线编辑器工作区为默认示例文件？')) return
    resetWorkspaceToDefault()
    toast.success('已重置在线编辑器工作区')
  }

  function resetPreferencesToDefault() {
    if (!window.confirm('确定将模型/偏好重置为默认值？')) return
    const cur = getSettings()
    setSettings({
      ...cur,
      model: 'qwen-plus',
      mockMode: true,
      authRequired: false,
    })
    toast.success('已重置偏好设置')
  }

  return (
    <PageShell fullBleed edgeToEdge>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-zinc-200/90 border-x-0 border-t-0 p-0 shadow-none dark:border-zinc-700/80">
        <form action={action} className="flex min-h-0 flex-1 flex-col">
          <div className={featureScrollBodyClass}>
            <div className="mx-auto flex w-full max-w-none flex-col gap-8">
              <section className="space-y-4">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  访问与守卫
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  开发调试时可标记本机已通过路由守卫，避免反复跳转。
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    守卫状态：
                    <span className="ml-2 font-semibold">
                      {guardPassed ? '已通过' : '未通过'}
                    </span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {guardPassed ? (
                      <Button type="button" intent="outline" onClick={clearGuardPassed}>
                        取消通过标记
                      </Button>
                    ) : (
                      <Button type="button" intent="outline" onClick={markGuardPassed}>
                        标记当前设备已通过守卫
                      </Button>
                    )}
                  </div>
                </div>
              </section>

              <section className="space-y-5 border-t border-zinc-200/70 pt-8 dark:border-zinc-700/70">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  模型与偏好
                </h2>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  模型名称
                  <Input name="model" defaultValue={current.model} className="mt-2" />
                </label>
                <label className="flex cursor-pointer items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                  <input
                    name="mockMode"
                    type="checkbox"
                    defaultChecked={current.mockMode}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900/20 dark:border-zinc-600 dark:focus:ring-white/20"
                  />
                  启用 Mock 回退
                </label>
                <label className="flex cursor-pointer items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                  <input
                    name="authRequired"
                    type="checkbox"
                    defaultChecked={current.authRequired}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900/20 dark:border-zinc-600 dark:focus:ring-white/20"
                  />
                  启用路由守卫
                </label>
              </section>

              {state ? (
                <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-sm text-emerald-800 dark:text-emerald-400/90">
                  {state}
                </p>
              ) : null}

              <div className="flex items-center gap-3 rounded-2xl border border-dashed border-zinc-200/90 bg-white/40 px-4 py-6 dark:border-zinc-600 dark:bg-zinc-900/20">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
                  <User className="h-5 w-5" />
                </div>
                <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  修改模型或开关后，在底部点击「保存设置」生效。
                </p>
              </div>

              <section className="space-y-5 border-t border-zinc-200/70 pt-8 dark:border-zinc-700/70">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  本地数据管理
                </h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Card className="p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                      对话条数
                    </p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{localCounts.convCount}</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                      编辑器文件
                    </p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{localCounts.fileCount}</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                      快照数量
                    </p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{localCounts.snapshotCount}</p>
                  </Card>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" intent="outline" onClick={clearLocalConversations}>
                    清空对话记录
                  </Button>
                  <Button type="button" intent="outline" onClick={resetEditorWorkspace}>
                    重置编辑器工作区
                  </Button>
                  <Button type="button" intent="outline" onClick={resetPreferencesToDefault}>
                    重置偏好为默认
                  </Button>
                </div>
              </section>
            </div>
          </div>
          <div className="shrink-0 border-t border-zinc-200/80 bg-zinc-50/70 px-4 py-5 dark:border-zinc-700/80 dark:bg-zinc-950/50 md:px-8 md:py-6">
            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              {pending ? '保存中...' : '保存设置'}
            </Button>
          </div>
        </form>
      </Card>
    </PageShell>
  )
}
