# Fastify 服务端接入

将 Agent 跑在 Fastify HTTP server 上，提供 REST 和 SSE 两种调用方式。

## 安装依赖

```bash
npm install fastify @fastify/cors
```

## 运行

```bash
npx tsx examples/server.ts
```

## 接口说明

| 端点 | 方式 | 说明 |
|------|------|------|
| `POST /api/chat` | 同步 | 等待完整结果，返回 `{ reply, usage }` |
| `POST /api/chat/stream` | SSE | 流式推送事件 |
| `GET /health` | 同步 | 健康检查 |

## curl 示例

```bash
# 普通调用
curl -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"分析 package.json"}'

# SSE 流式
curl -N -X POST http://localhost:3000/api/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"message":"用三句话介绍 TypeScript"}'
```

## 与前端集成

```typescript
// 前端：普通调用
const res = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: "你好" }),
})
const { reply, usage } = await res.json()

// 前端：SSE 流式（EventSource）
const es = new EventSource("/api/chat/stream", {
  method: "POST",
  body: JSON.stringify({ message: "你好" }),
})
es.addEventListener("message", (e) => {
  const event = JSON.parse(e.data)
  if (event.type === "text") process.stdout.write(event.data)
  if (event.type === "done") es.close()
})
```
