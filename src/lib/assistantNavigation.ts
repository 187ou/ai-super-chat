/**
 * 解析用户是否在表达「要去某个功能页」，用于全局助手自动切换路由。
 * 关键词与侧栏 `AppLayout` navItems 一致。
 */

export type AssistantNavIntent = {
  path: string
  /** 与侧栏展示一致，用于 toast / 文案 */
  label: string
  /** 用于匹配的子串（含中英文），越长越优先作为命中依据 */
  keywords: string[]
}

/** 顺序：更具体的关键词放在各自条目中；同一条内长词优先由调用方比较 length */
export const ASSISTANT_ROUTE_INTENTS: AssistantNavIntent[] = [
  { path: '/', label: '工作台', keywords: ['工作台', '首页', '主页', 'dashboard', 'home'] },
  { path: '/chat', label: 'AI 聊天', keywords: ['ai 聊天', '对话', '聊天', 'chat'] },
  {
    path: '/content-production',
    label: '内容生产',
    keywords: ['内容生产', '内容创作', '写作', 'content production'],
  },
  { path: '/codegen', label: '代码生成', keywords: ['代码生成', '生成代码', 'codegen', 'code gen'] },
  { path: '/editor', label: '在线编辑器', keywords: ['在线编辑器', 'monaco', '编辑器', 'editor'] },
  { path: '/apidoc', label: '接口文档', keywords: ['接口文档', 'api 文档', 'apidoc', 'swagger', 'openapi'] },
  { path: '/charts', label: '可视化', keywords: ['可视化', '图表', 'echarts', 'chart'] },
  {
    path: '/intelligent-analysis',
    label: '智能预测分析',
    keywords: ['智能预测分析', '智能预测', '预测分析', '智能分析', 'intelligent analysis'],
  },
  { path: '/debug', label: '调试修复', keywords: ['调试修复', '调试', 'debug'] },
  { path: '/multimodal', label: '多模态', keywords: ['多模态', 'multimodal', '视觉', '图片理解'] },
  { path: '/rag', label: '知识库检索', keywords: ['知识库检索', '知识库', 'rag', '向量检索', '文档检索'] },
  { path: '/profile', label: '个人中心', keywords: ['个人中心', '设置', '账户', 'profile', '偏好'] },
]

function normalizeForMatch(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * 根据用户输入匹配要打开的路径；同一句命中多个关键词时，取「匹配子串更长」的意图。
 */
export function matchAssistantNavigationIntent(userText: string): AssistantNavIntent | null {
  const raw = userText.trim()
  if (!raw) return null
  const lower = normalizeForMatch(raw)

  let best: { intent: AssistantNavIntent; score: number } | null = null

  for (const intent of ASSISTANT_ROUTE_INTENTS) {
    for (const kw of intent.keywords) {
      const k = kw.trim()
      if (!k) continue
      const kLower = normalizeForMatch(k)
      if (lower.includes(kLower) || raw.includes(k)) {
        const score = k.length
        if (!best || score > best.score) {
          best = { intent, score }
        }
      }
    }
  }

  return best?.intent ?? null
}

/** 更像「顺带提问」而非单纯跳转口令 */
function looksLikeFollowUpQuestion(q: string): boolean {
  return /[？?]|怎么|为什么|如何|怎样|帮我|请帮我|写|生成|告诉|解释|说明|实现|代码|例子|示例|报错|错误|修复/.test(q)
}

/**
 * 在已命中某意图时，判断是否可以只做跳转 + 本地提示，不调大模型（省流量、更快）。
 * 短句且不像在提问时，视为纯导航。
 */
export function shouldAssistantNavigateOnly(userText: string): boolean {
  const q = userText.trim()
  if (!q) return true
  if (q.length > 48) return false
  if (looksLikeFollowUpQuestion(q)) return false
  return true
}

export function getAssistantRouteLabel(pathname: string): string {
  const hit = ASSISTANT_ROUTE_INTENTS.find((i) => i.path === pathname)
  return hit?.label ?? pathname
}
