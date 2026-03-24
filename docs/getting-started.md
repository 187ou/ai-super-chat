# 快速开始

## 1. 安装依赖

在项目根目录执行：

```bash
pnpm install
```

## 2. 配置环境变量

在根目录准备以下文件：

- `.env`
- `.env.server`

可由模板复制：

- `.env.example` -> `.env`
- `.env.server.example` -> `.env.server`

关键配置示例：

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

## 3. 启动项目

推荐同时启动前后端：

```bash
pnpm dev:all
```

默认访问地址：

- 前端：`http://localhost:5173`
- 后端健康检查：`http://localhost:8787/health`

## 4. 启动文档站

```bash
pnpm docs:dev
```

默认访问地址：

- 文档站：`http://localhost:5173`（若被占用会自动切换端口）
