# AI Super Chat

一个面向前端开发场景的 AI 工作台，采用 React 19 + TypeScript + Vite 构建，内置聊天、代码生成、在线编辑器、RAG 知识库检索、多模态分析等能力。

## 功能概览

- 12 个页面模块：工作台、聊天、内容生产、代码生成、在线编辑器、接口文档、图表、智能预测分析、调试修复、多模态、知识库检索、个人中心
- 流式 AI 输出：前端 `ReadableStream` + 后端 SSE 代理
- 代码生成多场景：自然语言、UI 截图、API 文档、Schema、项目骨架、质量保证、代码讲解
- RAG 基础能力：文本上传、切分建库、检索增强问答、流式返回
- Monaco 在线编辑器：多文件、格式化、诊断、快照历史
- Markdown 渲染、代码高亮、复制、暗黑模式、路由守卫、本地持久化统计

## 技术栈

- 前端：React 19、TypeScript、Vite 8、TailwindCSS 4、React Router v6
- 组件与交互：Lucide React、Sonner、React Markdown、Rehype Highlight
- 编辑器与可视化：Monaco Editor、ECharts
- 后端：Node.js + Express 5 + CORS + Dotenv（AI 代理服务）

## 快速开始

### 1) 安装依赖

```bash
pnpm install
```

### 2) 配置环境变量

将模板文件复制为实际配置（Windows 可直接手动复制）：

- `.env.example` -> `.env`
- `.env.server.example` -> `.env.server`

最少需要确保以下配置存在：

```env
# .env
VITE_AI_PROXY_URL=http://localhost:8787/api/chat/stream
```

```env
# .env.server
SERVER_PORT=8787
CLIENT_ORIGIN=http://localhost:5173
TONGYI_API_URL=https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation
TONGYI_API_KEY=你的真实Key
MODEL_NAME=qwen-plus
```

如果使用截图代码生成，可额外配置视觉模型：

```env
VISION_MODEL=qwen-vl-plus
# 可选：不填则默认复用 TONGYI_API_URL
VISION_API_URL=https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation
```

### 3) 启动开发环境

同时启动前后端：

```bash
pnpm dev:all
```

仅前端：

```bash
pnpm dev:client
```

仅后端代理：

```bash
pnpm dev:server
```

### 4) 构建与预览

```bash
pnpm build
pnpm preview
```

## 在线使用手册（VitePress）

启动文档站：

```bash
pnpm docs:dev
```

构建文档站：

```bash
pnpm docs:build
pnpm docs:preview
```

文档入口：

- `docs/index.md`
- `docs/manual.md`（实操说明书）

## 页面与能力说明

- `/`：工作台（本地统计、快捷入口）
- `/chat`：AI 聊天（流式对话、历史记录、导出）
- `/content-production`：内容生产（文档/教程/说明类内容生成）
- `/codegen`：流式代码生成（多场景 + 截图输入）
- `/editor`：Monaco 在线编辑器（多文件、诊断、快照、格式化）
- `/apidoc`：接口文档生成（Swagger/OpenAPI 风格）
- `/charts`：自然语言生成图表配置（ECharts）
- `/intelligent-analysis`：趋势与分析建议生成
- `/debug`：问题诊断、修复建议与优化建议
- `/multimodal`：图片理解与实现建议
- `/rag`：知识库上传、建库与问答
- `/profile`：个人配置、模型与路由守卫相关设置

## 后端接口

健康检查：

- `GET /health`

聊天与生成：

- `POST /api/chat/stream`
- `POST /api/codegen/stream`

RAG：

- `POST /api/rag/kb/upload`
- `POST /api/rag/kb/delete`
- `POST /api/rag/answer`

## 代码生成场景参数

`POST /api/codegen/stream` 支持：

- `prompt`: 文本描述
- `scenario`: `natural` | `screenshot` | `apidoc` | `schema` | `skeleton` | `quality` | `explain`
- `imageBase64`: 当 `scenario=screenshot` 时可传入 data URL

说明：截图场景中，若仅上传图片未填写文字，服务端仍会调用视觉模型生成结果。

## RAG 使用说明

当前实现为轻量文本 RAG：

- 前端支持上传文本类文件（如 `.txt`、`.md` 等）
- 服务端按片段切分并存储，再进行关键词检索召回
- 问答接口走 SSE 流式返回

适合课程作业、文档问答、小型知识库演示场景。

## 常见问题

### 1) 为什么看起来不是“逐字流式”？

请确认：

- 后端请求上游时已携带 `X-DashScope-SSE: enable`
- 修改 `server/` 代码后已重启 `pnpm dev:server`
- 未被代理层/网关缓存或缓冲

### 2) 前端请求失败怎么办？

- 检查 `http://localhost:8787/health` 是否可访问
- 检查 `.env.server` 的 `TONGYI_API_KEY` 是否有效
- 检查模型权限、额度与接口地址

## 项目结构

```text
server/
  index.js          # 服务入口
  app.js            # Express 应用创建
  loadEnv.js        # .env.server/.env 加载逻辑
  routes/           # chat/codegen/rag 路由
  lib/              # provider、sse 等基础能力
  rag/              # chunking、retrieve、kbStore
  codegen/          # 代码生成消息模板

src/
  components/       # UI、布局、助手组件
  hooks/            # 主题、会话等 hooks
  lib/              # 流式请求、持久化、工具函数
  pages/            # 各业务页面
  types/            # TS 类型定义
  router.tsx        # 路由配置
  main.tsx          # 前端入口
```
