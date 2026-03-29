# 插件系统

插件是扩展 Agent 能力的核心方式。核心框架本身不内置任何"额外能力"——日志、遥测、RAG 等全部通过插件实现。

## 什么是插件

插件是一个对象，通过 Hook 函数在 Agent 运行的特定时机注入逻辑：

```
Agent 启动
  → beforeInput（收到输入时）
  → beforeModelCall（模型调用前）
  → 模型执行中
  → afterModelCall（模型调用后）
  → beforeToolCall（工具调用前）
  → 工具执行
  → afterToolCall（工具调用后）
  → afterStep（步骤完成后）
  → onComplete（运行完成）
  → onError（出错时）
```

## 基础示例：计时插件

```typescript
import { plugin } from "dao-ai"

const timer = plugin({
  name: "timer",
  hooks: {
    beforeModelCall: () => console.time("模型调用"),
    afterModelCall: () => console.timeEnd("模型调用"),
  },
})
```

## 注册插件

在 `agent()` 中注册：

```typescript
import { agent, logger } from "dao-ai"    // logger 是内置插件

const bot = agent({
  model: "deepseek/deepseek-chat",
  plugins: [logger(), timer],            // 数组，按顺序执行
})
```

也可以注册全局插件（所有 agent 共享）：

```typescript
import { configure, telemetryPlugin } from "dao-ai"

configure({
  globalPlugins: [telemetryPlugin({ serviceName: "my-app" })],
})
```

## Hook 详解

### beforeInput

在 Agent 收到用户输入时执行，适合做输入预处理或日志：

```typescript
const inputLogger = plugin({
  name: "input-logger",
  hooks: {
    beforeInput: (ctx) => {
      console.log("收到输入:", ctx.message)
    },
  },
})
```

### beforeModelCall / afterModelCall

在每次模型调用前后执行。V2.5 中 `ctx` 暴露了可写引用，`beforeModelCall` 可以修改 `systemPrompt` 和 `messages`：

```typescript
const ragInjector = plugin({
  name: "rag-injector",
  hooks: {
    beforeModelCall: async (ctx) => {
      // ✅ 修改 systemPrompt
      const docs = ctx.workspace?.get("docs")
      if (docs) {
        ctx.systemPrompt += `\n\n参考文档：\n${docs}`
      }

      // ✅ 压缩消息历史（只保留最近 20 条）
      if (ctx.messages && ctx.messages.length > 20) {
        ctx.messages.splice(0, ctx.messages.length - 20)
      }

      // ✅ 追加向量检索结果
      if (ctx.messages && ctx.messages.length > 0) {
        const lastMsg = ctx.messages[ctx.messages.length - 1]
        const query = typeof lastMsg.content === "string"
          ? lastMsg.content
          : lastMsg.content.find((p: any) => p.type === "text")?.text ?? ""
        const docs = await vectorDb.search(query, { topK: 3 })
        if (docs.length) {
          ctx.messages.push({
            role: "system",
            content: `相关文档：\n${docs.join("\n")}`,
          })
        }
      }
    },
    afterModelCall: async (ctx) => {
      // ctx.response 是 { text, usage }
      if (ctx.response?.usage) {
        console.log(`tokens: ${ctx.response.usage.totalTokens}`)
      }
    },
  },
})
```

### beforeToolCall / afterToolCall

在工具执行前后执行：

```typescript
const toolLogger = plugin({
  name: "tool-logger",
  hooks: {
    beforeToolCall: (ctx) => {
      console.log(`🔧 调用工具: ${ctx.tool}`, ctx.params)
    },
    afterToolCall: (ctx) => {
      console.log(`✅ 工具返回: ${String(ctx.result).slice(0, 100)}...`)
    },
  },
})
```

### afterStep

在每个步骤完成后执行（仅 `run()` 的 steps 模式有效）：

```typescript
const stepReporter = plugin({
  name: "step-reporter",
  hooks: {
    afterStep: (ctx) => {
      console.log(`步骤完成: ${ctx.step}`)
    },
  },
})
```

### onComplete

Agent 运行完成后执行（成功 / 失败 / 超时都会触发）：

```typescript
const runReporter = plugin({
  name: "run-reporter",
  hooks: {
    onComplete: async (ctx) => {
      console.log(`完成，耗时 ${ctx.result.duration}ms`)
      console.log(`tokens: ${ctx.result.usage.totalTokens}`)
    },
  },
})
```

### onError

Agent 出错时执行（模型调用失败、工具执行异常等）：

```typescript
const errorReporter = plugin({
  name: "error-reporter",
  hooks: {
    onError: async (ctx) => {
      // ctx.error — 错误对象
      await slack.notify(`Agent 错误: ${ctx.error.message}`)
      await bugsnag.notify(ctx.error)
    },
  },
})
```

## ask 工具（Agent 运行时提问）

`onAsk` 不是 plugin hook，而是 `agent()` 的配置项。当 Agent 需要向用户提问时，它通过内置的 `ask` 工具暂停执行并等待回答：

```typescript
const bot = agent({
  model: "deepseek/deepseek-chat",
  onAsk: async (question) => {
    // Agent 在运行中调用 ask({ question: "..." }) 时会触发这里
    const readline = await import("readline")
    const rl = readline.createInterface({ input: process.stdin })
    return await new Promise(resolve => {
      rl.question(question + "\n> ", answer => {
        rl.close()
        resolve(answer)
      })
    })
  },
})
```

Agent 内部会看到 `ask` 工具的描述："向用户提问，等待用户回答后继续执行"。它可以主动调用 `ask({ question: "..." })` 来暂停并提问。

## 实用插件示例

### 工具级重试

工具执行失败（网络抖动、外部 API 限流）很常见，用包装器给工具加自动重试：

```typescript
import { tool } from "dao-ai"

// 基础工具
const fetchData = tool({ name: "fetchData", params: { url: "URL" }, run: async ({ url }) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}})

// 包装器：指数退避重试（1s → 2s → 4s）
function withRetry(base, options = {}) {
  const { maxRetries = 3 } = options
  return tool({
    name: `[retry] ${base.name}`,
    description: base.description,
    params: base.params,
    run: async (params) => {
      for (let i = 0; i < maxRetries; i++) {
        try { return await base.run(params) }
        catch (err) {
          if (i < maxRetries - 1)
            await new Promise(r => setTimeout(r, 1000 * 2 ** i))
          else throw err
        }
      }
      throw err
    },
  })
}

const bot = agent({ model: "...", tools: [withRetry(fetchData)] })
```

完整示例见 [examples/retry-tool.ts](https://github.com/exposir/Dao/blob/main/examples/retry-tool.ts)。

### 批量任务 + 失败重试

跑 N 个任务、限制并发数、只重试失败项：

```typescript
// 并发限制器（纯 Promise，无需外部库）
async function concurrentBatch(tasks, limit) {
  let i = 0
  const run = async () => {
    while (i < tasks.length) {
      const cur = i++
      results[cur] = await tasks[cur]()
    }
  }
  await Promise.all(Array.from({ length: limit }, run))
}

// 10 个任务，并发数=3
const results = await concurrentBatch(
  urls.map(url => () => bot.run(`分析 ${url}`)),
  3
)
```

完整示例见 [examples/batch.ts](https://github.com/exposir/Dao/blob/main/examples/batch.ts)。

### 状态持久化

`state` 和 `workspace` 是内存 Map，进程重启即丢失。以下方案让多次 run 之间共享状态：

```typescript
// 文件持久化（零依赖）
const storage = new FileStorage("./dao-state.json")

// 或 Redis 持久化（分布式场景）
const storage = new RedisStorage(process.env.REDIS_URL!)

let state = new Map(Object.entries(await storage.read()))

const bot = agent({ model: "...", state })

// run 结束后自动写回
const run = bot.run.bind(bot)
bot.run = async (input) => {
  const result = await run(input)
  await storage.write(Object.fromEntries(state))
  return result
}
```

完整示例见 [examples/persistence.ts](https://github.com/exposir/Dao/blob/main/examples/persistence.ts)。

### RAG 检索增强

```typescript
const ragPlugin = plugin({
  name: "rag",
  hooks: {
    beforeModelCall: async (ctx) => {
      if (!ctx.messages?.length) return

      // 提取用户查询
      const lastMsg = ctx.messages[ctx.messages.length - 1]
      if (lastMsg?.role !== "user") return

      const query = typeof lastMsg.content === "string"
        ? lastMsg.content
        : lastMsg.content.find((p: any) => p.type === "text")?.text ?? ""

      const docs = await vectorDb.search(query, { topK: 3 })
      if (!docs.length) return

      ctx.systemPrompt += `\n\n[参考资料]\n${docs.map((d: string, i: number) => `${i + 1}. ${d}`).join("\n")}`
    },
  },
})
```

## HookContext 接口

V2.5 中 `beforeModelCall` 的 `ctx` 暴露了可写引用。以下是 `HookContext` 的完整字段说明：

```typescript
interface HookContext {
  // 基础属性
  agent: AgentInstance                        // 当前 Agent 实例
  timestamp: number                           // 事件时间戳
  store: Record<string, any>                 // 插件私有数据存储（同名插件共享）
  skip: () => void                            // 跳过后续核心行为（仅 beforeToolCall / beforeModelCall 生效）

  // 各 hook 传入的额外字段（通过 extra 参数传入，可直接访问）
  message?: MessageInput                      // beforeInput 时传入
  prompt?: string                            // beforeModelCall 时传入（system prompt 片段）
  systemPrompt?: string                      // beforeModelCall 时传入（可写）
  messages?: any[]                           // beforeModelCall 时传入（可写）
  response?: any                             // afterModelCall 时传入，格式为 { text, usage }
  tool?: string                              // beforeToolCall / afterToolCall 时传入
  params?: any                               // beforeToolCall 时传入
  result?: any                               // afterToolCall / afterStep / onComplete 时传入
  step?: Step                                // afterStep 时传入
  error?: Error                               // onError 时传入
}
```

> **注意**：各 hook 的 extra 字段都通过 `HookContext` 的索引签名 `[key: string]: any` 传入，TypeScript 里可以直接访问，但 IDE 不会自动补全。如需类型安全，可以在 hook 函数内部手动断言。

## 下一步

- [API 参考：plugin](/api#plugin) — 完整的 Hook 类型定义
- [Agent Loop](/agent-loop) — 各 Hook 在循环中的执行时机
- [telemetryPlugin 示例](/api#telemetryplugin) — OpenTelemetry 集成
- [examples/README.md](https://github.com/exposir/Dao/blob/main/examples/README.md) — 更多可运行的示例
