/**
 * Fastify 服务端接入示例
 *
 * 将 Agent 跑在 HTTP server 上，提供 REST 和 SSE 两种调用方式。
 *
 * 依赖：npm install fastify @fastify/cors
 * 运行：npx tsx examples/server.ts
 */

import "dotenv/config"
import Fastify from "fastify"
import cors from "@fastify/cors"
import { agent, tool } from "dao-ai"

const readFileTool = tool({
  name: "readFile",
  description: "读取文件内容",
  params: { path: { type: "string", description: "文件路径" } },
  async run({ path }) {
    const { readFile } = await import("node:fs/promises")
    try {
      return await readFile(path, "utf-8")
    } catch {
      return `无法读取文件：${path}`
    }
  },
})

const summarizeTool = tool({
  name: "summarize",
  description: "对文本进行摘要",
  params: { text: { type: "string", description: "待摘要的文本" } },
  run({ text }) {
    // 简单摘要：取前 100 字 + 省略号
    return text.length > 100 ? text.slice(0, 100) + "..." : text
  },
})

const bot = agent({
  role: "代码分析助手",
  goal: "读取文件并给出简要分析",
  model: "deepseek/deepseek-chat",
  tools: [readFileTool, summarizeTool],
  maxTurns: 10,
})

const fastify = Fastify({ logger: true })

await fastify.register(cors, { origin: true })

// ============================================================
// REST 接口
// ============================================================

/** POST /api/chat — 普通调用，等待完整结果 */
fastify.post("/api/chat", async (request, reply) => {
  const { message } = request.body as { message?: string }
  if (!message) {
    return reply.status(400).send({ error: "缺少 message 字段" })
  }
  const result = await bot.run(message)
  return { reply: result.output, usage: result.usage }
})

/** POST /api/chat/stream — SSE 流式调用 */
fastify.post("/api/chat/stream", async (request, reply) => {
  const { message } = request.body as { message?: string }
  if (!message) {
    return reply.status(400).send({ error: "缺少 message 字段" })
  }

  reply.raw?.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  })

  reply.raw?.write(": connected\n\n")

  try {
    for await (const event of bot.runStream(message)) {
      const SSE_DATA = `data: ${JSON.stringify(event)}\n\n`
      const canWrite = reply.raw?.write(SSE_DATA)
      if (!canWrite) {
        await new Promise<void>(resolve => reply.raw?.once("drain", resolve))
      }
    }
    reply.raw?.write("data: [DONE]\n\n")
    reply.raw?.end()
  } catch (err: any) {
    reply.raw?.write(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`)
    reply.raw?.end()
  }
})

// ============================================================
// 健康检查
// ============================================================

fastify.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }))

// ============================================================
// 启动
// ============================================================

async function main() {
  try {
    await fastify.listen({ port: 3000, host: "0.0.0.0" })
    console.log("\n✅ Agent 服务已启动：http://localhost:3000")
    console.log("\n接口说明：")
    console.log("  POST /api/chat          — 普通调用（同步）")
    console.log("  POST /api/chat/stream  — SSE 流式调用")
    console.log("  GET  /health           — 健康检查")
    console.log("\ncurl 示例：")
    console.log("  curl -X POST http://localhost:3000/api/chat -H 'Content-Type: application/json' -d '{\"message\":\"分析 package.json\"}'")
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

main()
