# MCP 协议支持

Dao 通过 `mcpTools()` 和 `mcpClient()` 桥接 MCP (Model Context Protocol) server 的工具。

## 安装

```bash
npm install @ai-sdk/mcp  # 可选依赖
```

## 快速开始

```typescript
import { agent, mcpTools } from "dao-ai"

// SSE 模式
const tools = await mcpTools({
  url: "http://localhost:3100/sse",
})

const bot = agent({
  model: "deepseek/deepseek-chat",
  tools,
})

await bot.run("列出当前目录的文件")
```

## 传输模式

### SSE（推荐）

```typescript
const tools = await mcpTools({
  url: "http://localhost:3100/sse",
})
```

### Stdio

```typescript
const tools = await mcpTools({
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", "./"],
  env: { HOME: process.env.HOME },
})
```

## 连接管理

默认的 `mcpTools()` 获取工具后不保留连接句柄。如需在结束时关闭连接，使用 `mcpClient()`：

```typescript
import { agent, mcpClient } from "dao-ai"

const { tools, close } = await mcpClient({
  url: "http://localhost:3100/sse",
})

const bot = agent({ tools })
await bot.run("执行任务")

// 使用完毕后关闭连接
await close()
```

## 工具转换

MCP server 的工具会自动转换为 Dao 的 `ToolInstance[]`：

| MCP 属性 | Dao 属性 |
|----------|----------|
| `name` | `name` |
| `description` | `description` |
| `inputSchema` | `schema` (JSON Schema) |
| `execute` | `execute` |

## 注意事项

- `@ai-sdk/mcp` 是可选的 peer dependency，不安装时调用 `mcpTools()` 会抛出明确错误
- MCP 工具的 `confirm` 默认为 `false`
- 支持所有 MCP server 实现（文件系统、数据库、Web 搜索等）
