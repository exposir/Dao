# API 设计文档

本文档定义 Dao 框架所有公开 API 的完整类型、参数说明和默认行为。

---

## 1. agent(options) → AgentInstance

创建一个 Agent。

### 快速示例

```typescript
import { agent } from "dao"

// 最简用法
const bot = agent({ model: "deepseek/deepseek-chat" })
await bot.chat("你好")

// 完整用法
const reviewer = agent({
  role: "代码审查员",
  model: "deepseek/deepseek-chat",
  tools: [readFile, listDir],
  steps: ["了解项目结构", "分析代码", "生成报告"],
  rules: { focus: ["代码质量"], reject: ["修改代码"] },
  memory: true,
})
const result = await reviewer.run("审查 src/ 目录")
console.log(result.output)
```

### 类型定义

```typescript
interface AgentOptions {
  /** 角色描述，会被注入到 system prompt 中 */
  role?: string

  /** 模型，格式为 "provider/model" */
  model?: string

  /** 可用工具列表（统一用 tool() 定义） */
  tools?: ToolInstance[]

  /**
   * 步骤列表，定义 Agent 的工作流程
   * 支持字符串指令、控制流对象、自定义函数
   */
  steps?: Step[]

  /** 规则约束 */
  rules?: {
    /** 关注点：Agent 应重点关注的方面 */
    focus?: string[]
    /** 拒绝行为：Agent 不允许做的事 */
    reject?: string[]
  }

  /** 
   * 是否开启记忆
   * @default false
   */
  memory?: boolean

  /** 插件列表 */
  plugins?: PluginInstance[]

  /**
   * 最大执行轮次（一次 run 中模型调用的上限）
   * @default 50
   */
  maxTurns?: number

  /**
   * 是否开启流式输出
   * @default true
   */
  stream?: boolean

  /**
   * 温度参数
   * @default undefined（使用模型默认值）
   */
  temperature?: number

  /**
   * system prompt 前缀，会拼接在 role 之前
   * 用于注入全局指令
   */
  systemPrompt?: string

  // === 以下为预留扩展点（V0.1 不实现） ===

  /**
   * 工具确认回调（预留）
   * 当 tool 设置了 confirm: true 时调用，用户自定义确认方式
   * 不提供时默认用 CLI stdin 确认
   */
  onConfirm?: (toolName: string, params: any) => Promise<boolean>

  /**
   * 备用模型（预留）
   * 主模型调用失败时自动切换
   */
  fallbackModel?: string

  /**
   * 上下文窗口配置（预留）
   * 用于自动截断和压缩
   */
  contextWindow?: {
    maxTokens?: number
    /** 超出时的策略：截断早期消息 / 摘要压缩 */
    strategy?: "truncate" | "summarize"
  }

  /**
   * 自定义模型提供者（预留）
   * 传入已有的模型实例，跳过 resolveModel() 解析
   * 测试时可注入 mock 模型，生产时可用于自定义模型
   */
  modelProvider?: LanguageModel
}
```

### Step 类型

```typescript
/** 步骤可以是以下任意类型 */
type Step =
  | string                          // 字符串指令，交给 LLM 执行
  | ParallelStep                    // 并行执行
  | ConditionalStep                 // 条件分支（可带 retry）
  | ((ctx: StepContext) => any)     // 自定义函数

interface ParallelStep {
  parallel: (string | Step | (() => Promise<any>))[]
}

interface ConditionalStep {
  /** 条件：字符串（LLM 判断）或函数（代码判断） */
  if: string | ((ctx: StepContext) => boolean | Promise<boolean>)
  then: string | Step
  else?: string | Step
  /** 可选：失败时重试次数 */
  retry?: number
}

// WaitStep 计划在 V0.5 支持，V0.1 不包含
// interface WaitStep { wait: string }
// AgentInstance 将在 V0.5 新增 resume(data?: any): Promise<RunResult>
```

### StepContext

```typescript
interface StepContext {
  /** 上一步的执行结果 */
  lastResult: any

  /** 所有步骤的执行历史 */
  history: { step: Step; result: any }[]

  /** 当前 Agent 实例 */
  agent: AgentInstance

  /** 手动中止执行 */
  abort: (reason?: string) => void
}
```

### AgentInstance

```typescript
interface AgentInstance {
  /** 对话模式：单轮问答，保持上下文 */
  chat(message: string): Promise<string>

  /** 任务模式：执行任务直到完成 */
  run(task: string): Promise<RunResult>

  /** 流式对话 */
  chatStream(message: string): AsyncIterable<string>

  /** 流式任务执行 */
  runStream(task: string): AsyncIterable<RunEvent>

  /** 清除记忆 */
  clearMemory(): void

  /** 获取当前配置 */
  getConfig(): AgentOptions
}

interface RunResult {
  /** 最终输出文本 */
  output: string

  /** 执行的步骤记录 */
  steps: { step: Step; result: any }[]

  /** 使用的 token 数 */
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }

  /** 执行耗时（毫秒） */
  duration: number
}

interface RunEvent {
  type: "text" | "tool_call" | "tool_result" | "step_start" | "step_end" | "error" | "done"
  data: any
}
```

---

## 2. team(options) → TeamInstance

创建一个 Agent 团队。

> ⚠️ team() 计划在 V1.0 实现，以下为 API 设计预览。

### 快速示例

```typescript
import { agent, team } from "dao"

const planner = agent({ role: "架构师", tools: [readFile] })
const coder = agent({ role: "开发者", tools: [readFile, writeFile] })
const tester = agent({ role: "测试工程师", tools: [readFile, runCommand] })

const squad = team({
  members: { planner, coder, tester },
})
await squad.run("给项目添加用户登录功能")
```

### 类型定义

```typescript
interface TeamOptions {
  /**
   * 调度 Agent（可选）
   * 不提供时框架自动生成一个调度 Agent
   */
  lead?: AgentInstance

  /** 团队成员，key 为成员名称 */
  members: Record<string, AgentInstance>

  /** 插件列表（挂在 lead 上，不注入 member） */
  plugins?: PluginInstance[]

  /**
   * 最大调度轮次
   * @default 20
   */
  maxRounds?: number
}
```

### TeamInstance

```typescript
interface TeamInstance {
  /** 执行团队任务 */
  run(task: string): Promise<TeamRunResult>

  /** 流式执行 */
  runStream(task: string): AsyncIterable<TeamRunEvent>
}

interface TeamRunResult {
  /** 最终输出 */
  output: string

  /** 每个成员的执行记录 */
  memberResults: Record<string, RunResult[]>

  /** 总 token 用量 */
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }

  /** 总耗时 */
  duration: number
}

interface TeamRunEvent {
  type: "delegate" | "member_start" | "member_end" | "text" | "error" | "done"
  member?: string
  data: any
}
```

### 调度机制

```typescript
// 简单模式：框架自动生成 lead
const squad = team({
  members: { planner, coder, tester },
})
// 等价于：
const squad = team({
  lead: agent({
    role: "调度员",
    // 框架自动生成的 system prompt 包含所有成员的 role 描述
    // lead 通过工具调用来委派任务给成员
  }),
  members: { planner, coder, tester },
})
```

lead 内部会为每个 member 自动生成一个工具：

```typescript
// 自动生成的工具示意（返回 output 字符串给 lead，team 层另外收集完整 RunResult）
tool({
  name: "delegate_to_planner",
  description: "委派任务给架构师。架构师的职责：分析需求、制定方案、拆分任务",
  params: { task: "任务描述" },
  run: async ({ task }) => {
    const result = await planner.run(task)
    return result.output  // 返回 output 给 lead
  },
})
```

---

## 3. tool() — 定义工具

### 快速示例

```typescript
import { tool } from "dao"

const readFile = tool({
  name: "readFile",
  description: "读取文件内容",
  params: { path: "文件路径" },
  run: ({ path }) => fs.readFileSync(path, "utf-8"),
})
```

### 类型定义

```typescript
function tool(options: ToolOptions): ToolInstance

interface ToolOptions {
  /** 工具名称 */
  name: string

  /** 工具描述，会展示给 LLM */
  description: string

  /** 参数定义 */
  params: ParamsDef

  /** 执行函数 */
  run: (params: any, ctx?: ToolContext) => any | Promise<any>
  // V0.1 参数类型为 any，V0.5 计划通过泛型从 params 定义自动推导类型

  /**
   * 执行前是否需要用户确认
   * @default false
   */
  confirm?: boolean
}
```

### 参数定义（ParamsDef）

```typescript
/**
 * 参数定义支持两种格式：
 * - 简写：{ key: "描述" } — 默认类型为 string
 * - 完整：{ key: { type: "...", description: "..." } } — 指定类型
 */
type ParamsDef = Record<string, string | ParamSpec>

interface ParamSpec {
  type: "string" | "number" | "boolean" | "array" | "object"
  description: string
  optional?: boolean
  items?: { type: string }
}
```

### 示例

```typescript
import { tool } from "dao"

// 基础用法
const readFile = tool({
  name: "readFile",
  description: "读取文件",
  params: { path: "文件路径" },
  run: ({ path }) => fs.readFileSync(path, "utf-8"),
})

// 需要确认
const writeFile = tool({
  name: "writeFile",
  description: "写入文件",
  params: { path: "文件路径", content: "文件内容" },
  run: ({ path, content }) => fs.writeFileSync(path, content),
  confirm: true,
})

// 非 string 类型
const deleteFiles = tool({
  name: "deleteFiles",
  description: "批量删除",
  params: {
    paths: { type: "array", description: "文件列表" },
    force: { type: "boolean", description: "强制删除" },
  },
  run: ({ paths, force }) => ...,
})
```

### 内部转换

框架自动将简写参数转为 JSON Schema：

```typescript
// 用户写的
{ path: "文件路径" }

// 框架转为
{
  type: "object",
  properties: {
    path: { type: "string", description: "文件路径" }
  },
  required: ["path"]
}
```

> 不需要 Zod。所有 API 统一传一个对象。

### ToolInstance

```typescript
interface ToolInstance {
  __type: "tool"
  name: string
  description: string
  schema: JSONSchema
  execute: (params: any, ctx?: ToolContext) => Promise<any>
  confirm: boolean
}
```

### ToolContext

```typescript
interface ToolContext {
  /** 当前 Agent 实例 */
  agent: AgentInstance
  /** 中止执行 */
  abort: (reason?: string) => void
}
```

---

## 4. plugin(options) → PluginInstance

定义一个插件。

> ⚠️ plugin() 计划在 V1.0 实现，以下为 API 设计预览。

### 快速示例

```typescript
import { plugin, agent } from "dao"

function logger() {
  return plugin({
    name: "logger",
    hooks: {
      beforeModelCall: (ctx) => console.log("调用模型:", ctx.prompt),
      afterToolCall: (ctx) => console.log("工具结果:", ctx.result),
      onError: (ctx) => console.error("出错:", ctx.error),
    },
  })
}

const bot = agent({ plugins: [logger()] })
```

### 类型定义

```typescript
interface PluginOptions {
  /** 插件名称 */
  name: string

  /** 
   * 插件初始化函数（可选）
   * 在 Agent 创建时调用
   */
  setup?: (agent: AgentInstance) => void | Promise<void>

  /** Hook 函数 */
  hooks?: {
    /** 用户输入前 */
    beforeInput?: (ctx: HookContext & { message: string }) => void | Promise<void>

    /** 模型调用前 */
    beforeModelCall?: (ctx: HookContext & { prompt: string }) => void | Promise<void>

    /** 模型调用后 */
    afterModelCall?: (ctx: HookContext & { response: any }) => void | Promise<void>

    /** 工具调用前 */
    beforeToolCall?: (ctx: HookContext & { tool: string; params: any }) => void | Promise<void>

    /** 工具调用后 */
    afterToolCall?: (ctx: HookContext & { tool: string; result: any }) => void | Promise<void>

    /** 步骤完成后 */
    afterStep?: (ctx: HookContext & { step: Step; result: any }) => void | Promise<void>

    /** 执行完成 */
    onComplete?: (ctx: HookContext & { result: RunResult }) => void | Promise<void>

    /** 执行出错 */
    onError?: (ctx: HookContext & { error: Error }) => void | Promise<void>
  }
}

interface HookContext {
  /** 当前 Agent 实例 */
  agent: AgentInstance

  /** 事件时间戳 */
  timestamp: number

  /** 在 context 上存储插件数据 */
  store: Record<string, any>

  /** 
   * 跳过后续核心行为。所有 hook 都可调用，
   * 但仅在 beforeToolCall / beforeModelCall 中生效。
   */
  skip: () => void
}
```

### PluginInstance

```typescript
interface PluginInstance {
  __type: "plugin"
  name: string
  setup?: (agent: AgentInstance) => void | Promise<void>
  hooks: PluginOptions["hooks"]
}
```

---

## 5. 全局配置

### 快速示例

```typescript
import { configure } from "dao"

configure({
  defaultModel: "deepseek/deepseek-chat",
  defaultMaxTurns: 30,
})
```

### 类型定义

```typescript
import { configure } from "dao"

function configure(options: ConfigOptions): void

interface ConfigOptions {
  /** 默认模型（所有 agent 不指定 model 时使用） */
  defaultModel?: string

  /**
   * 默认最大轮次
   * @default 50
   */
  defaultMaxTurns?: number

  /**
   * 默认是否开启流式
   * @default true
   */
  defaultStream?: boolean

  /** 全局插件（所有 agent 自动加载） */
  globalPlugins?: PluginInstance[]

  // === 以下为预留扩展点（V0.1 不实现） ===

  /**
   * 模型调用重试配置（预留）
   */
  retry?: {
    /** 最大重试次数 @default 3 */
    maxRetries?: number
    /** 是否使用指数退避 @default true */
    backoff?: boolean
  }

  /**
   * 可观测性配置（预留）
   * 启用后自动收集 tracing、token 用量等
   */
  telemetry?: {
    enabled?: boolean
    /** 自定义数据导出目标 */
    exporter?: (event: any) => void
  }

  /**
   * 成本上限（预留）
   * 单次 run 超过限额自动停止
   */
  maxCostPerRun?: number
}
```

---

## 6. 导出总览

```typescript
// dao 主入口
export { agent } from "./agent"
export { team } from "./team"
export { tool } from "./tool"
export { plugin } from "./plugin"
export { configure } from "./config"
export { registerProvider } from "./model"

// registerProvider 类型
function registerProvider(name: string, entry: ProviderEntry): void
interface ProviderEntry {
  create: (apiKey: string) => Promise<any>  // 异步，动态 import provider
  envKey: string
  defaultModel: string
}

// dao/tools 内置工具（V1.0 计划）
// export { readFile, writeFile, listDir, runCommand, search } from "dao/tools"

// dao/plugins 内置插件（V1.0 计划，工厂函数，调用后返回插件实例）
// export { logger } from "dao/plugins"
```
