# 插件系统设计文档

---

## 1. 设计目标

- 核心精简，扩展能力通过插件
- 插件不能破坏核心行为
- 插件之间独立，不相互依赖

---

## 2. Hook 生命周期

```
agent.run("任务")
  │
  ├─ beforeInput(ctx)                ← ctx.message
  │
  ├─ [Agent Loop 开始]
  │   │
  │   ├─ beforeModelCall(ctx)        ← ctx.prompt
  │   │
  │   ├─ [模型调用]
  │   │
  │   ├─ afterModelCall(ctx)         ← ctx.response
  │   │
  │   ├─ [如果有工具调用]
  │   │   ├─ beforeToolCall(ctx)     ← ctx.tool, ctx.params
  │   │   ├─ [工具执行]
  │   │   └─ afterToolCall(ctx)      ← ctx.tool, ctx.result
  │   │
  │   └─ [循环直到完成]
  │
  ├─ afterStep(step, result)        ← Steps 引擎每步完成后
  │
  ├─ onComplete(result)             ← 正常完成
  └─ onError(error)                 ← 出错
```

---

## 3. HookContext 详解

```typescript
interface HookContext {
  /** 当前 Agent 实例（只读） */
  agent: AgentInstance

  /** 事件时间戳 */
  timestamp: number

  /** 
   * 插件私有数据存储
   * 按插件 name 索引，同名插件实例共享同一个 store
   */
  store: Record<string, any>

  /** 
   * 跳过后续核心行为。所有 hook 都可调用，
   * 但仅在 beforeToolCall / beforeModelCall 中生效。
   */
  skip: () => void
}
```

---

## 4. 插件示例

### 4.1 Logger 插件

```typescript
import { plugin } from "dao-ai"

// 工厂函数：调用后返回插件实例
function logger() {
  return plugin({
    name: "logger",
    hooks: {
      beforeModelCall: (ctx) => {
        console.log(`[${new Date().toISOString()}] 调用模型`)
      },
      afterToolCall: (ctx) => {
        console.log(`[${new Date().toISOString()}] 工具 ${ctx.tool}: ${JSON.stringify(ctx.result).slice(0, 100)}`)
      },
      onComplete: (ctx) => {
        console.log(`[${new Date().toISOString()}] 完成，耗时 ${ctx.result.duration}ms`)
      },
      onError: (ctx) => {
        console.error(`[${new Date().toISOString()}] 错误:`, ctx.error.message)
      },
    },
  })
}
```

### 4.2 Token 计数插件

```typescript
const tokenCounter = plugin({
  name: "token-counter",
  setup: (agent) => {
    // 初始化计数
  },
  hooks: {
    afterModelCall: (ctx) => {
      ctx.store.totalTokens = (ctx.store.totalTokens || 0) + ctx.response.usage.totalTokens
    },
    onComplete: (ctx) => {
      console.log(`总 Token 用量: ${ctx.store.totalTokens}`)
    },
  },
})
```

### 4.3 工具审批插件

```typescript
const approval = plugin({
  name: "approval",
  hooks: {
    beforeToolCall: async (ctx) => {
      if (ctx.tool === "writeFile" || ctx.tool === "runCommand") {
        const ok = await askUser(`允许执行 ${ctx.tool}(${JSON.stringify(ctx.params)})？`)
        if (!ok) ctx.skip()
      }
    },
  },
})
```

---

## 5. 插件执行顺序

多个插件的同名 hook 按注册顺序执行：

```typescript
const bot = agent({
  plugins: [pluginA, pluginB, pluginC],
})

// beforeModelCall 执行顺序：
// 1. pluginA.hooks.beforeModelCall
// 2. pluginB.hooks.beforeModelCall
// 3. pluginC.hooks.beforeModelCall
```

如果某个插件的 hook 调用了 `skip()`，后续插件的该 hook **不会执行**，核心行为（如工具执行、模型调用）也会被跳过。

---

## 6. 全局插件 vs 实例插件

```typescript
import { configure, agent } from "dao-ai"

// 全局插件：所有 agent 自动加载
configure({
  globalPlugins: [logger()],
})

// 实例插件：仅当前 agent 加载
const bot = agent({
  plugins: [tokenCounter],  // logger + tokenCounter
})
```

执行顺序：全局插件先于实例插件。
