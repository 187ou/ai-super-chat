import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '../lib/monacoSetup'
import Editor from '@monaco-editor/react'
import type { Monaco } from '@monaco-editor/react'
import type { editor as MEditor } from 'monaco-editor'
import {
  AlertCircle,
  AlertTriangle,
  Code2,
  FilePlus,
  History,
  Info,
  Loader2,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { featureScrollBodyClass, PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { useTheme } from '../hooks/useTheme'
import {
  defaultWorkspace,
  languageFromPath,
  loadWorkspace,
  nextUntitledPath,
  persistWorkspace,
  pushHistory,
  type EditorFile,
  type HistorySnapshot,
} from '../lib/editorWorkspace'
import { cn } from '../lib/utils'

function severityIcon(sev: number) {
  switch (sev) {
    case 8:
      return <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
    case 4:
      return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
    default:
      return <Info className="h-3.5 w-3.5 shrink-0 text-blue-500" />
  }
}

export default function EditorPage() {
  const { darkMode } = useTheme()
  const [bundle] = useState(() => loadWorkspace())
  const [files, setFiles] = useState<EditorFile[]>(bundle.files)
  const [activeId, setActiveId] = useState(bundle.activeId)
  const [history, setHistory] = useState<HistorySnapshot[]>(bundle.history)
  const [markers, setMarkers] = useState<MEditor.IMarker[]>([])
  const [rightTab, setRightTab] = useState<'problems' | 'history'>('problems')
  const [monacoReady, setMonacoReady] = useState(false)

  const editorRef = useRef<MEditor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const markersListenerRef = useRef<{ dispose: () => void } | null>(null)

  const activeFile = useMemo(() => files.find((f) => f.id === activeId) ?? files[0], [files, activeId])

  useEffect(() => {
    const t = window.setTimeout(() => {
      persistWorkspace({ files, activeId, history })
    }, 500)
    return () => window.clearTimeout(t)
  }, [files, activeId, history])

  const refreshMarkers = useCallback(() => {
    const ed = editorRef.current
    const monaco = monacoRef.current
    if (!ed || !monaco) return
    const model = ed.getModel()
    if (!model) return
    setMarkers(monaco.editor.getModelMarkers({ resource: model.uri }))
  }, [])

  const onMount = useCallback(
    (editor: MEditor.IStandaloneCodeEditor, monaco: Monaco) => {
      editorRef.current = editor
      monacoRef.current = monaco
      setMonacoReady(true)

      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        noEmit: true,
        esModuleInterop: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        reactNamespace: 'React',
        allowJs: true,
        strict: true,
        skipLibCheck: true,
      })
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        allowNonTsExtensions: true,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        noEmit: true,
        allowJs: true,
      })
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      })

      markersListenerRef.current?.dispose()
      markersListenerRef.current = monaco.editor.onDidChangeMarkers(() => {
        refreshMarkers()
      })
      editor.onDidChangeModelContent(() => refreshMarkers())
      refreshMarkers()
    },
    [refreshMarkers],
  )

  useEffect(() => {
    return () => {
      markersListenerRef.current?.dispose()
    }
  }, [])

  useEffect(() => {
    if (!monacoReady) return
    refreshMarkers()
  }, [activeFile?.path, monacoReady, refreshMarkers])

  function updateContent(id: string, content: string) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, content } : f)))
  }

  function addFile() {
    const id = `f_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())}`
    const path = nextUntitledPath('tsx')
    const blank: EditorFile = {
      id,
      path,
      content: "export {}\n",
    }
    setFiles((prev) => [...prev, blank])
    setActiveId(id)
    toast.success('已新建文件')
  }

  function removeActiveFile() {
    if (files.length <= 1) {
      toast.error('至少保留一个文件')
      return
    }
    const idx = files.findIndex((f) => f.id === activeId)
    const next = files.filter((f) => f.id !== activeId)
    const fallback = next[Math.max(0, idx - 1)] ?? next[0]
    setFiles(next)
    setActiveId(fallback.id)
    toast.message('已删除文件')
  }

  async function formatDocument() {
    const ed = editorRef.current
    if (!ed) {
      toast.error('编辑器未就绪')
      return
    }
    try {
      await ed.getAction('editor.action.formatDocument')?.run()
      toast.success('已格式化')
    } catch {
      toast.error('格式化失败（当前语言可能不支持）')
    }
  }

  function saveSnapshot() {
    const label = new Date().toLocaleString()
    setHistory((h) => pushHistory(h, label, files))
    toast.success('已记录版本快照')
  }

  function restoreSnapshot(snap: HistorySnapshot) {
    setFiles(snap.files.map((f) => ({ ...f })))
    setActiveId(snap.files[0]?.id ?? activeId)
    setRightTab('problems')
    toast.success('已恢复到该版本（可继续编辑并再存快照）')
  }

  function resetWorkspace() {
    if (!window.confirm('将清空本地工作区并恢复示例文件，确定？')) return
    const w = defaultWorkspace()
    setFiles(w.files)
    setActiveId(w.activeId)
    setHistory([])
    toast.message('已重置工作区')
  }

  if (!activeFile) {
    return (
      <PageShell fullBleed edgeToEdge>
        <div className="flex flex-1 items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell fullBleed edgeToEdge>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-zinc-200/90 border-x-0 border-t-0 p-0 shadow-none dark:border-zinc-700/80">
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* 主编辑区 */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-zinc-200/80 dark:border-zinc-700/80 md:border-b-0 md:border-r">
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-200/70 bg-zinc-50/90 px-2 py-2 dark:border-zinc-700/60 dark:bg-zinc-900/50">
              <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                <Code2 className="mx-1 h-4 w-4 shrink-0 text-zinc-500" />
                {files.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActiveId(f.id)}
                    className={cn(
                      'shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                      f.id === activeId
                        ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50'
                        : 'text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/80',
                    )}
                    title={f.path}
                  >
                    {f.path.replace(/^\//, '')}
                  </button>
                ))}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                <Button type="button" size="sm" intent="outline" className="h-8 gap-1 px-2 text-xs" onClick={addFile}>
                  <FilePlus className="h-3.5 w-3.5" />
                  新建
                </Button>
                <Button
                  type="button"
                  size="sm"
                  intent="outline"
                  className="h-8 gap-1 px-2 text-xs"
                  onClick={removeActiveFile}
                  disabled={files.length <= 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  删除
                </Button>
                <Button type="button" size="sm" intent="outline" className="h-8 gap-1 px-2 text-xs" onClick={() => void formatDocument()}>
                  <Sparkles className="h-3.5 w-3.5" />
                  格式化
                </Button>
                <Button type="button" size="sm" intent="outline" className="h-8 gap-1 px-2 text-xs" onClick={saveSnapshot}>
                  <Save className="h-3.5 w-3.5" />
                  记录快照
                </Button>
                <Button type="button" size="sm" intent="outline" className="h-8 gap-1 px-2 text-xs" onClick={resetWorkspace}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  重置
                </Button>
              </div>
            </div>

            <div className="min-h-[min(480px,55vh)] flex-1 md:min-h-0">
              <Editor
                height="100%"
                path={activeFile.path}
                language={languageFromPath(activeFile.path)}
                theme={darkMode ? 'vs-dark' : 'vs'}
                value={activeFile.content}
                onChange={(v) => updateContent(activeFile.id, v ?? '')}
                onMount={onMount}
                loading={
                  <div className="flex h-[min(480px,55vh)] items-center justify-center bg-zinc-100/80 dark:bg-zinc-900/80">
                    <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
                  </div>
                }
                options={{
                  minimap: { enabled: true },
                  fontSize: 14,
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  insertSpaces: true,
                  formatOnPaste: true,
                  quickSuggestions: { other: true, comments: true, strings: true },
                  suggestOnTriggerCharacters: true,
                  acceptSuggestionOnEnter: 'on',
                  tabCompletion: 'on',
                  wordBasedSuggestions: 'matchingDocuments',
                  parameterHints: { enabled: true },
                  renderValidationDecorations: 'on',
                }}
              />
            </div>
          </div>

          {/* 问题 + 历史 */}
          <aside className="flex w-full shrink-0 flex-col border-t border-zinc-200/80 bg-zinc-50/50 dark:border-zinc-700/80 dark:bg-zinc-950/40 md:w-[300px] md:border-t-0 md:border-l">
            <div className="flex shrink-0 border-b border-zinc-200/70 dark:border-zinc-700/60">
              <button
                type="button"
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium',
                  rightTab === 'problems'
                    ? 'border-b-2 border-violet-600 text-zinc-900 dark:border-violet-400 dark:text-zinc-50'
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400',
                )}
                onClick={() => setRightTab('problems')}
              >
                <AlertCircle className="h-3.5 w-3.5" />
                问题 {markers.length ? `(${markers.length})` : ''}
              </button>
              <button
                type="button"
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium',
                  rightTab === 'history'
                    ? 'border-b-2 border-violet-600 text-zinc-900 dark:border-violet-400 dark:text-zinc-50'
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400',
                )}
                onClick={() => setRightTab('history')}
              >
                <History className="h-3.5 w-3.5" />
                历史
              </button>
            </div>

            <div className={cn(featureScrollBodyClass, 'max-h-[40vh] min-h-[200px] md:max-h-none md:flex-1')}>
              {rightTab === 'problems' ? (
                <ul className="space-y-2 p-3">
                  {markers.length === 0 ? (
                    <li className="text-xs text-zinc-500 dark:text-zinc-400">暂无诊断信息</li>
                  ) : (
                    markers.map((m, i) => (
                      <li
                        key={`${m.resource.toString()}-${m.startLineNumber}-${m.startColumn}-${i}`}
                        className="rounded-lg border border-zinc-200/80 bg-white/80 px-2 py-1.5 text-xs dark:border-zinc-700/80 dark:bg-zinc-900/60"
                      >
                        <div className="flex items-start gap-2">
                          {severityIcon(m.severity)}
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-[10px] text-zinc-500">
                              L{m.startLineNumber}:{m.startColumn}
                            </p>
                            <p className="mt-0.5 text-zinc-800 dark:text-zinc-200">{m.message}</p>
                          </div>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              ) : (
                <ul className="space-y-2 p-3">
                  {history.length === 0 ? (
                    <li className="text-xs text-zinc-500 dark:text-zinc-400">
                      点击「记录快照」保存当前多文件状态，可随时恢复。
                    </li>
                  ) : (
                    [...history].reverse().map((h) => (
                      <li
                        key={h.id}
                        className="rounded-lg border border-zinc-200/80 bg-white/80 p-2 dark:border-zinc-700/80 dark:bg-zinc-900/60"
                      >
                        <p className="text-[11px] font-medium text-zinc-800 dark:text-zinc-100">{h.label}</p>
                        <p className="mt-0.5 text-[10px] text-zinc-500">{h.files.length} 个文件</p>
                        <Button
                          type="button"
                          size="sm"
                          intent="outline"
                          className="mt-2 h-7 w-full text-xs"
                          onClick={() => restoreSnapshot(h)}
                        >
                          恢复此版本
                        </Button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </Card>
    </PageShell>
  )
}
