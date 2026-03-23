/**
 * AI 代理服务入口：加载环境、创建应用并监听端口。
 * 模块聚合导出见 `./exports.js`（避免从此文件 import 时误启动服务）。
 */
import { loadEnv } from './loadEnv.js'
import { createApp } from './app.js'

loadEnv()

const app = createApp()
const port = Number(process.env.SERVER_PORT || 8787)

app.listen(port, () => {
  console.log(`AI proxy running on http://localhost:${port}`)
})
