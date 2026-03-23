export const CODEGEN_SYSTEM_BASE = `你是资深全栈工程师，精通 React 19、TypeScript、Vite、Tailwind CSS。
请根据当前模式与用户提供的信息交付内容，遵循：
- 优先 TypeScript / TSX；组件函数式；类型与 Props 清晰。
- 若场景需要，可输出 JSON、SQL、Markdown 等。
- **生成代码类场景**：先用简短中文说明要点，再用 markdown 代码块（可多个，按文件/步骤分块并注明路径），语言标记为 tsx、ts、json 等；代码须完整可编译。
- **质量保证 / 解释与文档场景**：以中文 Markdown 组织（可分节、列表、表格）；审查结论、说明文字与**改进后代码**或**带 JSDoc 的代码片段**均用 markdown 代码块呈现，便于复制。`

export const CODEGEN_SCENARIO_SUFFIX = {
  natural: `\n【模式：自然语言】根据文字描述生成前端/逻辑代码。`,
  screenshot: `\n【模式：UI 截图】若用户上传了图片，请根据截图的布局、配色、字号层次、间距与组件结构，生成尽量还原的 React+TS+Tailwind 代码；无图时仅根据文字说明生成。`,
  apidoc: `\n【模式：API 文档】根据 OpenAPI/Swagger 或接口描述，生成 TypeScript 类型、fetch/axios 封装、错误处理与可选的 React Query hooks。`,
  schema: `\n【模式：数据库 Schema】根据 DDL 或表结构说明，生成实体类型、Repository/Service 层或 REST CRUD 路由示例（择一合理栈）。`,
  skeleton: `\n【模式：项目骨架】根据需求文档生成 monorepo 或单目录结构、package.json 脚本、入口文件、路由占位与 README 片段。`,
  quality: `\n【模式：代码质量保证】用户对代码做审查与加固。请先给出结构化审查（问题、严重度、依据），再对关键项给出**可合并的改进版代码**（markdown 代码块，保持 TS/TSX）。覆盖：类型与空值、副作用与依赖、性能与重渲染、a11y、安全（XSS/注入）、可测试性与错误边界；避免空泛建议。`,
  explain: `\n【模式：代码解释与文档】用户需要读懂代码并沉淀文档。请：1）用中文分层次说明职责、数据流与关键决策；2）为导出函数/组件/类型补充 **JSDoc 或 TSDoc**（在代码块中给出补全后的片段）；3）可选生成 README 小节或「对外 API」列表（Markdown）。以清晰、可维护为先，避免复述每一行无意义注释。`,
}

export function buildCodegenUserText(scenario, prompt) {
  const p = typeof prompt === 'string' ? prompt.trim() : ''
  switch (scenario) {
    case 'natural':
      return `请根据以下需求生成代码：\n\n${p}`
    case 'screenshot':
      return `请根据上传的 UI 截图生成前端代码（React + TypeScript + Tailwind）。\n补充说明：\n${p || '（无）'}`
    case 'apidoc':
      return `请根据以下 API 文档/接口描述生成接口调用代码与类型：\n\n${p}`
    case 'schema':
      return `请根据以下数据库 Schema 生成 CRUD 相关代码（类型、服务层或路由示例）：\n\n${p}`
    case 'skeleton':
      return `请根据以下需求文档生成项目骨架（目录、package.json、关键文件占位）：\n\n${p}`
    case 'quality':
      return `请对以下代码做质量审查，并给出改进后的代码（如有必要）：\n\n${p}`
    case 'explain':
      return `请解释以下代码并补充文档（注释、JSDoc/TSDoc 或 README 片段）：\n\n${p}`
    default:
      return `请根据以下需求生成代码：\n\n${p}`
  }
}

/** 构建 DashScope messages；支持 vision 多模态（user.content 为数组） */
export function buildCodegenMessages(scenario, prompt, imageBase64) {
  const system = CODEGEN_SYSTEM_BASE + (CODEGEN_SCENARIO_SUFFIX[scenario] ?? CODEGEN_SCENARIO_SUFFIX.natural)
  const userText = buildCodegenUserText(scenario, prompt)
  const hasImage =
    typeof imageBase64 === 'string' &&
    imageBase64.length > 80 &&
    (imageBase64.startsWith('data:image') || imageBase64.startsWith('http'))

  if (scenario === 'screenshot' && hasImage) {
    const dataUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`
    return [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [{ image: dataUrl }, { text: userText }],
      },
    ]
  }

  return [
    { role: 'system', content: system },
    { role: 'user', content: userText },
  ]
}
