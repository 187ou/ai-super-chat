import type { LucideIcon } from 'lucide-react'
import { BookOpen, Database, FolderTree, ImageIcon, MessageSquare, ScrollText, ShieldCheck } from 'lucide-react'

export type CodegenScenarioId =
  | 'natural'
  | 'screenshot'
  | 'apidoc'
  | 'schema'
  | 'skeleton'
  | 'quality'
  | 'explain'

export type CodegenScenarioMeta = {
  id: CodegenScenarioId
  label: string
  short: string
  description: string
  placeholder: string
  icon: LucideIcon
}

export const CODEGEN_SCENARIOS: CodegenScenarioMeta[] = [
  {
    id: 'natural',
    label: '自然语言',
    short: '描述生成',
    description: '用中文/英文描述组件、页面或逻辑，生成 TSX 代码。',
    placeholder:
      '例如：生成一个带 Suspense 的用户信息卡片，使用 use() 拉取 /api/user，含加载与错误态…',
    icon: MessageSquare,
  },
  {
    id: 'screenshot',
    label: 'UI 截图',
    short: '截图还原',
    description: '上传界面截图（建议 PNG/JPG），可选补充说明；需视觉模型（如 qwen-vl-plus）。',
    placeholder: '可选：说明重点（如「顶部导航固定」「主色 #3b82f6」）…',
    icon: ImageIcon,
  },
  {
    id: 'apidoc',
    label: 'API 文档',
    short: '接口代码',
    description: '粘贴 OpenAPI/Swagger JSON 或接口清单，生成 TS 类型与请求封装。',
    placeholder: '粘贴 openapi.json 片段，或列出 GET /users、POST /login 等路径与字段…',
    icon: BookOpen,
  },
  {
    id: 'schema',
    label: '数据库 Schema',
    short: 'CRUD',
    description: '粘贴建表 SQL（DDL）或表结构说明，生成实体与 CRUD 相关代码。',
    placeholder: '例如 CREATE TABLE users (id UUID PRIMARY KEY, email TEXT…',
    icon: Database,
  },
  {
    id: 'skeleton',
    label: '需求文档',
    short: '项目骨架',
    description: '根据产品/技术需求生成目录结构、package.json、入口与 README 草稿。',
    placeholder: '描述模块划分、技术栈（Vite/React）、是否需要路由与状态管理…',
    icon: FolderTree,
  },
  {
    id: 'quality',
    label: '质量保证',
    short: '审查改进',
    description: '审查类型安全、性能、可访问性、安全与 React 最佳实践，给出问题清单与可落地的重构代码。',
    placeholder:
      '粘贴待审查的 TS/TSX 代码；可补充约束（如「必须兼容 React 19」「禁止 any」）…',
    icon: ShieldCheck,
  },
  {
    id: 'explain',
    label: '解释与文档',
    short: '注释文档',
    description: '解释代码逻辑与设计意图，补充 JSDoc/TSDoc、README 片段或模块说明，便于维护与交接。',
    placeholder:
      '粘贴需要说明的代码；可说明关注点（如「只解释 useEffect 依赖」「生成对外 API 文档」）…',
    icon: ScrollText,
  },
]

export function getScenarioMeta(id: CodegenScenarioId): CodegenScenarioMeta {
  return CODEGEN_SCENARIOS.find((s) => s.id === id) ?? CODEGEN_SCENARIOS[0]
}
