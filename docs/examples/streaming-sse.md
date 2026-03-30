# SSE 事件流

`runStream()` 返回 `AsyncIterable<RunEvent>`，可以实时推送 `step_start` / `text` / `step_end` / `done` 四类事件。

## 运行

```bash
npx tsx examples/streaming-sse.ts
curl http://localhost:3000/events
```

## 代码

```typescript
// examples/streaming-sse.ts
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

// SSE 端点
function handleSSE(req: http.IncomingMessage, res: http.ServerResponse) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  })

  const task = "TypeScript 是一种由微软开发的..."

  ;(async () => {
    try {
      for await (const event of bot.runStream(task)) {
        // SSE 格式：data: <json>\n\n
        const canWrite = res.write(`data: ${JSON.stringify(event)}\n\n`)
        // 背压处理：客户端慢时暂停
        if (!canWrite) {
          await new Promise<void>(resolve => res.once("drain", resolve))
        }
        logEvent(event)
      }
      res.write("data: [DONE]\n\n")
      res.end()
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`)
      res.end()
    }
  })()
}
```

## 事件类型

| 类型 | 说明 |
|------|------|
| `step_start` | 步骤开始，`{ step, index }` |
| `text` | 文本片段，流式输出，`{ data: string }` |
| `step_end` | 步骤完成，`{ step, index, result }` |
| `done` | 全部完成，`{ usage }` 含 token 统计 |

## 客户端接入

```typescript
// Node.js fetch
const res = await fetch("http://localhost:3000/events")
const reader = res.body!.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  const line = decoder.decode(value)
  if (line.startsWith("data: ")) {
    const event = JSON.parse(line.slice(6))
    console.log(event)
  }
}
```

```typescript
// 前端 EventSource
const es = new EventSource("http://localhost:3000/events")
es.addEventListener("message", (e) => {
  const event = JSON.parse(e.data)
  console.log(event)
})
```
