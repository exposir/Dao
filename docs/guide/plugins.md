# 插件系统

插件是扩展 Agent 能力的核心方式。核心框架本身不内置任何"额外能力"——日志、遥测、缓存等全部通过插件实现。

## 什么是插件

插件是一个对象，通过 Hook 函数在 Agent 运行的特定时机注入逻辑：

```
Agent 启动
  → beforeModelCall（模型调用前）
  → 模型执行中
  → afterModelCall（模型调用后）
  → beforeToolCall（工具调用前）
  → afterToolCall（工具调用后）
  → onError（出错时）
  → onAsk（Agent 向用户提问时）
Agent 结束
  → afterRun（运行结束后）
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
import { configure } from "dao-ai"

configure({
  globalPlugins: [telemetryPlugin({ serviceName: "my-app" })],
})
```

## Hook 详解

### beforeModelCall / afterModelCall

在每次 LLM 调用前后执行。V2.5 中 `ctx` 暴露了可写引用：

```typescript
const ragInjector = plugin({
  name: "rag-injector",
  hooks: {
    beforeModelCall: async (ctx) => {
      // ✅ 修改 systemPrompt
      ctx.systemPrompt += `\n\n参考文档：\n${ctx.workspace.get("docs")}`

      // ✅ 压缩消息历史（只保留最近 20 条）
      if (ctx.messages.length > 20) {
        ctx.messages.splice(0, ctx.messages.length - 20)
      }

      // ✅ 追加用户查询的向量检索结果
      const docs = await vectorDb.search(ctx.messages.at(-1).text)
      ctx.messages.push({
        role: "system",
        content: `相关文档：${docs.join("\n")}`,
      })
    },
    afterModelCall: async (ctx, result) => {
      // ✅ 记录 token 消耗
      console.log(`tokens: ${result.usage.totalTokens}`)
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
    beforeToolCall: (ctx, toolName, params) => {
      console.log(`🔧 调用工具: ${toolName}`, params)
    },
    afterToolCall: (ctx, toolName, result) => {
      console.log(`✅ 工具返回: ${result.slice(0, 100)}...`)
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
    onError: async (ctx, error) => {
      await slack.notify(`Agent 错误: ${error.message}`)
      await bugsnag.notify(error)
    },
  },
})
```

### onAsk

当 Agent 调用内置的 `ask` 工具暂停运行时，向用户提问：

```typescript
const cliAsker = plugin({
  name: "cli-ask",
  hooks: {
    onAsk: async (ctx, question) => {
      // 用于 CLI 场景
      const readline = await import("readline")
      const rl = readline.createInterface({ input: process.stdin })
      return await new Promise(resolve => {
        rl.question(question + "\n> ", answer => {
          rl.close()
          resolve(answer)
        })
      })
    },
  },
})
```

### afterRun

Agent 完成（成功 / 失败 / 超时）后执行：

```typescript
const runReporter = plugin({
  name: "run-reporter",
  hooks: {
    afterRun: async (ctx, result) => {
      console.log(`完成，耗时 ${result.duration}ms`)
      console.log(`tokens: ${result.usage.totalTokens}`)
      if (result.error) console.error("错误:", result.error)
    },
  },
})
```

## 实用插件示例

### RAG 检索增强

```typescript
import { plugin } from "dao-ai"

const ragPlugin = plugin({
  name: "rag",
  hooks: {
    beforeModelCall: async (ctx) => {
      const lastMsg = ctx.messages.at(-1)
      if (!lastMsg || lastMsg.role !== "user") return

      const docs = await vectorDb.search(lastMsg.content, { topK: 3 })
      if (!docs.length) return

      ctx.systemPrompt += `\n\n[参考资料]\n${docs.map((d, i) => `${i + 1}. ${d}`).join("\n")}`
    },
  },
})
```

### 缓存相同查询

```typescript
const cachePlugin = plugin({
  name: "cache",
  hooks: {
    beforeModelCall: async (ctx) => {
      const lastMsg = ctx.messages.at(-1)
      if (lastMsg?.role !== "user") return

      const cached = cache.get(lastMsg.content)
      if (cached) {
        // 跳过模型调用，直接返回缓存结果
        ctx.skipModel = true
        ctx.cachedResult = cached
      }
    },
    afterModelCall: async (ctx, result) => {
      const lastMsg = ctx.messages.at(-1)
      if (lastMsg?.role === "user") {
        cache.set(lastMsg.content, result)
      }
    },
  },
})
```

## HookContext 接口

V2.5 之前 context 是只读的，V2.5 新增可写引用：

```typescript
interface HookContext {
  // 只读属性
  readonly agent: AgentInstance
  readonly tools: Tool[]
  readonly requestId: string

  // V2.5 新增：可写引用
  systemPrompt: string                        // 可修改 system prompt
  messages: Message[]                          // 可增删压缩消息
  workspace: Map<string, any>                  // 步骤间共享数据

  // V2.5 新增：控制流
  skipModel?: boolean                          // 跳过模型调用
  cachedResult?: string                        // 配合 skipModel 使用
}
```

## 下一步

- [API 参考：plugin](/api#plugin) — 完整的 Hook 类型定义
- [Agent Loop](/agent-loop) — 各 Hook 在循环中的执行时机
- [telemetryPlugin 示例](/api#telemetryplugin) — OpenTelemetry 集成
