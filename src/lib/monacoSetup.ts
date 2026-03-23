/**
 * 必须在加载 @monaco-editor/react 之前执行，为 Vite 配置 TS/JS/JSON 等 Worker。
 */
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker.js?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker.js?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker.js?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker.js?worker'

type MonacoEnv = {
  getWorker: (_workerId: string, label: string) => Worker
}

export function setupMonacoEnvironment(): void {
  if (typeof globalThis === 'undefined') return
  const g = globalThis as typeof globalThis & { MonacoEnvironment?: MonacoEnv }
  if (g.MonacoEnvironment) return

  g.MonacoEnvironment = {
    getWorker(_workerId, label) {
      switch (label) {
        case 'json':
          return new JsonWorker()
        case 'css':
        case 'scss':
        case 'less':
          return new CssWorker()
        case 'html':
        case 'handlebars':
        case 'razor':
          return new HtmlWorker()
        case 'typescript':
        case 'javascript':
          return new TsWorker()
        default:
          return new EditorWorker()
      }
    },
  }
}

setupMonacoEnvironment()
