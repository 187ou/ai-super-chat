# AI Developer Assistant

基于 React 19 + TypeScript + Vite + TailwindCSS + ShadCN 风格组件 + React Router v6 构建的企业级 AI 开发工作台。

## 核心能力

- 9 个业务页面：工作台、聊天、代码生成、**在线编辑器（Monaco）**、接口文档、图表、调试、多模态、个人中心
- React 19 语法：`use`、`Suspense`、`form action`、`useActionState`
- AI 流式输出：Fetch `ReadableStream` + Mock 回退
- Function Calling 示例能力（工具调用结果展示）
- Markdown 渲染、代码高亮、一键复制
- 本地历史持久化 + 可选云端缓存同步
- 自然语言转 ECharts（折线/柱状/饼图/雷达）
- 暗黑/亮色切换、全局通知、响应式布局

## 技术栈

- React 19
- TypeScript
- Vite 8
- TailwindCSS 4
- React Router v6
- ECharts
- Sonner、React Markdown、Lucide React

## 快速启动

```bash
pnpm install
pnpm dev:all
```

仅前端调试：

```bash
pnpm dev:client
```

仅后端代理：

```bash
pnpm dev:server
```

构建前端产物：

```bash
pnpm build
pnpm preview
```

## 环境变量（前后端代理模式）

1) 复制前端变量模板：

```bash
cp .env.example .env
```

2) 在 `.env` 中确保：

```env
VITE_AI_PROXY_URL=http://localhost:8787/api/chat/stream
```

3) 复制后端变量模板并配置真实 Key：

```bash
cp .env.server.example .env.server
```

`.env.server` 示例：

```env
SERVER_PORT=8787
CLIENT_ORIGIN=http://localhost:5173
TONGYI_API_URL=https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation
TONGYI_API_KEY=你的真实通义Key
MODEL_NAME=qwen-plus

# 代码生成「UI 截图」模式（多模态）：与纯文本可共用同一 DashScope 兼容接口，或按控制台文档单独配置
# VISION_MODEL=qwen-vl-plus
# VISION_API_URL=https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation
```

> 当前代理使用 `dotenv.config()` 读取 `.env`。你可以把 `TONGYI_API_KEY` 直接写入 `.env`，或将 `.env.server` 内容合并到 `.env`。

### 代码生成多场景

`/api/codegen/stream` 请求体除 `prompt` 外支持：

- `scenario`：`natural` | `screenshot` | `apidoc` | `schema` | `skeleton` | `quality`（代码质量保证）| `explain`（代码解释与文档）（默认 `natural`）
- `imageBase64`：截图模式下的图片 **data URL**（`data:image/png;base64,...`）

截图模式若未填文字但已上传图片，后端仍会调用模型；需在服务端配置可用的视觉模型名与（若与文本不同）多模态 endpoint。

### 聊天「流式输出」不逐字出现？

DashScope 文本生成接口必须在请求头携带 **`X-DashScope-SSE: enable`** 才会按 SSE 推送；否则上游一次返回整段 JSON，前端只能最后一次性显示。本仓库代理已默认加上该头。**修改 `server/` 下任意文件后请重启** `pnpm dev:server`。

前端解析 SSE 时需把 **`\\r\\n` 规范成 `\\n` 再按空行分帧**；若只用 `\\n\\n` 分割而上游实际是 `\\r\\n\\r\\n`，会导致整段响应积在缓冲区里，看起来像「没有流式」。当前 `src/lib/ai.ts` 与 `server/lib/sse.js` 已按帧解析。

## 页面说明

- `/`：工作台入口 + 最近能力
- `/chat`：AI 流式聊天 + 历史 + 导出/清空
- `/codegen`：通义千问流式代码生成（`POST /api/codegen/stream`），多场景（自然语言 / UI 截图 / API 文档 / 数据库 Schema / 需求→项目骨架 / **代码质量保证** / **代码解释与文档**）、停止、复制代码块、完整回复切换；失败时本地降级模板。**UI 截图**需配置视觉模型（如 `qwen-vl-plus`），可选 `VISION_API_URL`；请求体较大时代理已提高 JSON 体积上限
- `/editor`：**Monaco** 在线编辑；语法高亮、TS/JS **智能补全**、**实时诊断**（问题面板）、**多文件标签**、**版本快照**（本地历史恢复）、**格式化**（内置 Format Document）；工作区持久化到 `localStorage`
- `/apidoc`：接口文档自动生成（Swagger JSON）
- `/charts`：自然语言转 ECharts
- `/debug`：代码调试、修复、优化建议
- `/multimodal`：图片上传分析并生成实现建议
- `/profile`：模型配置、Mock 模式、路由守卫设置

## 项目结构

```text
server/
  index.js          # 入口：监听端口
  app.js            # createApp()
  loadEnv.js        # 加载 .env.server / .env
  exports.js        # 模块统一导出（脚本/测试用，勿与 index 混用）
  lib/              # SSE、上游配置等
  codegen/          # 代码生成 prompts / messages
  routes/           # chat、codegen 路由注册
src/
  components/
    common/
    layout/
    ui/
  hooks/
  lib/
  pages/
  types/
  main.tsx
  router.tsx
  index.css
```
