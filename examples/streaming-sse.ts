/**
 * 事件流（SSE）示例
 *
 * 运行后启动一个 HTTP 服务（:3000），通过 SSE（Server-Sent Events）实时推送 Agent 运行事件。
 *
 * 事件类型：
 *   - step_start：步骤开始
 *   - text：文本片段（流式输出）
 *   - step_end：步骤完成
 *   - done：全部完成
 *
 * 运行：npx tsx examples/streaming-sse.ts
 * 访问：http://localhost:3000/events
 */

import "dotenv/config"
import http from "node:http"
import { agent, tool } from "dao-ai"

const echoTool = tool({
  name: "echo",
  description: "原样返回输入内容",
  params: { text: { type: "string", description: "要返回的文本" } },
  run: ({ text }) => text,
})

const bot = agent({
  role: "内容总结助手",
  goal: "对用户输入的内容进行简明总结",
  model: "deepseek/deepseek-chat",
  tools: [echoTool],
  steps: [
    "分析用户提供的内容，理解核心主题",
    "用 echo 工具输出一句话总结",
  ],
})

/**
 * SSE 端点：GET /events
 * 返回类型为 text/event-stream，持续推送 Agent 运行事件
 */
function handleSSE(req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.url !== "/events") {
    res.writeHead(404)
    res.end("Not Found")
    return
  }

  // 设置 SSE 响应头
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no", // 禁用 Nginx 缓冲
  })

  // 立即发送一个 ping（有些客户端需要初始数据才启动）
  res.write(": connected\n\n")

  const task = "TypeScript 是一种由微软开发的静态类型化编程语言，它是 JavaScript 的超集，添加了类型系统和面向对象特性。TypeScript 编译成纯 JavaScript，可以在任何浏览器、操作系统和环境中运行。"

  ;(async () => {
    try {
      for await (const event of bot.runStream(task)) {
        const SSE_DATA = `data: ${JSON.stringify(event)}\n\n`
        const canWrite = res.write(SSE_DATA)
        // 背压处理：客户端慢时暂停生成
        if (!canWrite) {
          await new Promise<void>(resolve => res.once("drain", resolve))
        }

        // 实时打印到服务端控制台
        logEvent(event)
      }
      res.write("data: [DONE]\n\n")
      res.end()
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`)
      res.end()
    }
  })()

  // 30 秒超时自动关闭连接
  const timeout = setTimeout(() => {
    res.write("data: [TIMEOUT]\n\n")
    res.end()
  }, 30_000)

  req.on("close", () => clearTimeout(timeout))
}

/** 解析 SSE 事件的客户端演示（Node.js fetch） */
async function demoFetchClient() {
  console.log("\n[客户端] 正在通过 fetch 接收 SSE 事件...\n")

  const res = await fetch("http://localhost:3000/events")
  if (!res.body) throw new Error("No body")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // 解析完整的 SSE 事件（以 \n\n 结尾）
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const raw = line.slice(6)
          if (raw === "[DONE]" || raw === "[TIMEOUT]") {
            console.log(`\n[客户端] 连接关闭: ${raw}`)
            return
          }
          const event = JSON.parse(raw)
          logEvent(event, "[客户端]")
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/** 将事件打印为结构化日志 */
function logEvent(event: any, prefix = "[服务端]") {
  switch (event.type) {
    case "step_start":
      console.log(`${prefix} ▶ 步骤开始：${event.data.step}`)
      break
    case "text":
      process.stdout.write(`${prefix} text: ${event.data}`)
      break
    case "step_end":
      console.log(`\n${prefix} ✓ 步骤完成：${event.data.step}`)
      break
    case "done":
      console.log(`${prefix} ✓ 全部完成，消耗 token:`, event.data?.usage)
      break
    default:
      console.log(`${prefix}`, event)
  }
}

async function main() {
  const server = http.createServer(handleSSE)

  await new Promise<void>(resolve => server.listen(3000, resolve))
  console.log("SSE 服务已启动：http://localhost:3000/events")
  console.log("用浏览器或 curl 访问：curl http://localhost:3000/events\n")

  // 同时演示 fetch 客户端接收
  await demoFetchClient()

  server.close()
}

main()
