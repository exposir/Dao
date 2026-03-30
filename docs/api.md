# API 设计文档

本文档定义 Dao 框架所有公开 API 的完整类型、参数说明和默认行为。

---

## 1. agent(options) → AgentInstance

创建一个 Agent。

### 快速示例

```typescript
import { agent } from "dao-ai"

// 最简用法
const bot = agent({ model: "deepseek/deepseek-chat" })
await bot.chat("你好")

// 简单模式：role + goal + background → 框架自动拼 prompt
const reviewer = agent({
  role: "代码审查员",
  goal: "找出代码中的 bug 和安全隐患",
  background: "你有 10 年 TypeScript 经验，熟悉常见安全漏洞",
  model: "deepseek/deepseek-chat",
  tools: [readFile, listDir],
})

// 专家模式：systemPrompt 完全自定义，覆盖 role/goal/background
const expert = agent({
  systemPrompt: "你是一个严格的代码审计工具，只输出 JSON 格式的审计报告...",
  model: "deepseek/deepseek-chat",
  tools: [readFile, listDir],
})

const result = await reviewer.run("审查 src/ 目录")
console.log(result.output)
```

### 类型定义

```typescript
interface AgentOptions {
  /** 角色描述，会被注入到 system prompt 中 */
  role?: string

  /** 目标：告诉 LLM 它要完成什么（可选，拼入 prompt） */
  goal?: string

  /** 背景：告诉 LLM 它为什么能完成（可选，拼入 prompt） */
  background?: string

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
   * 温度参数
   * @default undefined（使用模型默认值）
   */
  temperature?: number

  /**
   * 完全自定义 system prompt（专家模式）
   * 提供此参数时，忽略 role / goal / background 的自动拼接
   */
  systemPrompt?: string

  // === V1.1：生产可靠性 ===

  /** 重试配置，AI SDK 内置指数退避 + 429 自动等待 @default { maxRetries: 2 } */
  retry?: { maxRetries?: number }

  /** 超时时间（毫秒），超时抛出 TimeoutError */
  timeout?: number

  /** 单次模型调用的最大输出 token 数 */
  maxTokens?: number

  // === V2.0：能力补全 ===

  /** 工具确认回调，工具 confirm: true 时调用 */
  onConfirm?: (toolName: string, params: any) => Promise<boolean>

  /** 备用模型，主模型失败后自动切换 */
  fallbackModel?: string

  /** 可委派的 Agent 列表，自动注入 delegate 工具 */
  delegates?: Record<string, AgentInstance>

  // === V2.3：生产增强 ===

  /** 上下文窗口配置 */
  contextWindow?: {
    /** 最大消息数（滑动窗口），与 maxTokens 二选一 */
    maxMessages?: number
    /** 最大 token 数（滑动窗口），与 maxMessages 二选一，字符数/2 估算 */
    maxTokens?: number
  }

  /** 单次执行的最大 token 数，超限抛 CostLimitError */
  maxCostPerRun?: number

  /** 自定义模型提供者，测试时可注入 mock */
  modelProvider?: LanguageModel

  /** 中途提问回调 (V2.5)，提供后自动注入 ask 工具 */
  onAsk?: (question: string) => Promise<string>
}
```

### 多模态输入 (V2.4)

```typescript
/** 消息输入，支持纯文本或多模态内容 */
type MessageInput = string | ContentPart[]

type ContentPart = TextPart | ImagePart | FilePart

interface TextPart {
  type: "text"
  text: string
}

interface ImagePart {
  type: "image"
  /** 图片 URL、base64、ArrayBuffer 或 Uint8Array */
  image: string | URL | ArrayBuffer | Uint8Array
}

interface FilePart {
  type: "file"
  data: string | ArrayBuffer | Uint8Array
  mediaType: string
  filename?: string
}
```

### Step 类型

```typescript
/** 步骤可以是以下任意类型 */
type Step =
  | string                          // 字符串指令，交给 LLM 执行
  | TaskStep                        // 任务步骤（带输出预期和校验）
  | WaitStep                        // 等待步骤（暂停执行，等待 resume）
  | ParallelStep                    // 并行执行
  | ConditionalStep                 // 条件分支（可带 retry）
  | ((ctx: StepContext) => any)     // 自定义函数

/** 任务步骤：带输出预期和校验 (V1.2) */
interface TaskStep {
  task: string
  /** 输出预期，拼入 prompt 引导格式 */
  output?: string
  /** 输出校验，返回 true 通过，返回字符串为失败原因 */
  validate?: (result: string) => boolean | string
  /** 校验失败时重试次数 @default 0 */
  maxRetries?: number
}

/** 等待步骤：暂停执行，等待 resume() 调用 */
interface WaitStep {
  wait: true
  reason?: string
}

interface ParallelStep {
  parallel: (string | Step | (() => Promise<any>))[]
  /** 并发限制 (V1.1) @default Infinity */
  concurrency?: number
}

interface ConditionalStep {
  if: string | ((ctx: StepContext) => boolean | Promise<boolean>)
  then: string | Step
  else?: string | Step
  retry?: number
}
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

  /** 步骤间共享工作区 (V2.5) */
  workspace: Map<string, any>
}
```

### AgentInstance

```typescript
interface AgentInstance {
  /** 对话模式（支持文本或多模态输入） */
  chat(message: MessageInput): Promise<string>

  /** 任务模式 */
  run(task: MessageInput): Promise<RunResult>

  /** 流式对话 */
  chatStream(message: MessageInput): AsyncIterable<string>

  /** 流式任务执行 */
  runStream(task: MessageInput): AsyncIterable<RunEvent>

  /** 结构化输出任务执行 (V2.2) */
  generate<T>(task: string, options: GenerateOptions<T>): Promise<GenerateResult<T>>

  /**
   * > [!NOTE]
   * > `run()`、`runStream()`、`generate()` 都是无状态的一次性调用，
   * > 不读取也不写入 `messageHistory`，无论 `memory: true` 与否。
   * > 只有 `chat()` / `chatStream()` 会使用和维护上下文记忆。
   */

  resume(data?: any): void

  /** 清除记忆 */
  clearMemory(): void

  /** 获取当前配置 */
  getConfig(): AgentOptions

  /** 运行时共享状态 (V2.5) */
  state: Map<string, any>
}

interface RunResult {
  /** 唯一执行 ID，用于链路追踪 (V2.4) */
  requestId: string
  output: string
  turns: { turn: string; result: any }[]
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
  duration: number
}

/** 结构化输出配置 (V2.2) */
interface GenerateOptions<T = any> {
  /** 支持 Zod schema、AI SDK Schema 或原生 JSON Schema 对象 */
  schema: import("zod").ZodType<T> | import("ai").Schema<T> | Record<string, any>
  schemaName?: string
  schemaDescription?: string
}

/** 结构化输出结果 (V2.2) */
interface GenerateResult<T = any> {
  object: T
  usage: TokenUsage
  duration: number
}

/** 流式事件 */
type RunEvent =
  | { type: "text"; data: string }
  | { type: "done"; data: { usage?: TokenUsage } | null }
  | { type: "step_start"; data: { step: string; index: number } }
  | { type: "step_end"; data: { step: string; index: number; result: any } }
  | { type: "tool_call"; data: { tool: string; params: any; result: any } }
```

---

## 2. team(options) → TeamInstance

创建一个 Agent 团队。



### 快速示例

```typescript
import { agent, team } from "dao-ai"

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

  /** 调度策略 */
  strategy?: "auto" | "sequential" | "parallel"

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

  /** 获取成员列表 */
  getMembers(): Record<string, AgentInstance>
}
```

> [!WARNING]
> 同一个 TeamInstance **不支持并发** `run()` / `runStream()`。
> `memberResults` 和流式回调是实例级闭包状态，并发调用会互相污染。
> 需要并行执行时，请创建多个 team 实例。

```typescript
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

// 团队流式事件：透传 lead 的所有事件 + member 字段
type TeamRunEvent = RunEvent & { member: string }
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

lead 内部自动获得一个通用 `delegate` 工具：

```typescript
// 框架自动生成的委派工具（单个通用工具，通过 member 参数指定目标）
tool({
  name: "delegate",
  description: "委派任务给团队成员执行。可用成员：planner(架构师), coder(开发者), tester(测试)",
  params: {
    member: "团队成员名称",
    task: "要委派的任务描述",
  },
  run: async ({ member, task }) => {
    const result = await members[member].run(task)
    return result.output  // 返回 output 给 lead
  },
})
```

---

## 3. tool() — 定义工具

### 快速示例

```typescript
import { tool } from "dao-ai"

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
import { tool } from "dao-ai"

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



### 快速示例

```typescript
import { plugin, agent } from "dao-ai"

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
    beforeModelCall?: (ctx: HookContext & {
      prompt: string
      /** 可写：当前 system prompt (V2.5) */
      systemPrompt: string
      /** 可写：即将发送给模型的消息列表 (V2.5) */
      messages: any[]
    }) => void | Promise<void>

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
import { configure } from "dao-ai"

configure({
  defaultModel: "deepseek/deepseek-chat",
  defaultMaxTurns: 30,
})
```

### 类型定义

```typescript
import { configure } from "dao-ai"

function configure(options: ConfigOptions): void

interface ConfigOptions {
  /** 默认模型（所有 agent 不指定 model 时使用） */
  defaultModel?: string

  /**
   * 默认最大轮次
   * @default 50
   */
  defaultMaxTurns?: number

  /** 全局插件（所有 agent 自动加载） */
  globalPlugins?: PluginInstance[]

  // === 预留扩展点 ===

  /**
   * 可观测性配置 (V2.4)
   */
  telemetry?: {
    enabled?: boolean
    exporter?: (event: any) => void
  }

  /**
   * 成本上限 (V2.3)
   */
  maxCostPerRun?: number
}
```

---

## 6. 导出总览

```typescript
// dao-ai 主入口
export { agent } from "./agent"
export { tool } from "./tool"
export { configure } from "./core/config"
export { registerProvider, resetProviders } from "./core/model"
export { compileRules } from "./rules"
export { plugin, logger } from "./plugin"
export { team } from "./team"
export { mockModel } from "./mock"
export { AbortError } from "./engine"
export { DaoError, ModelError, ToolError, TimeoutError, CostLimitError } from "./core/errors"

// V2.4 新增
export { mcpTools, mcpClient } from "./mcp"
export { telemetryPlugin } from "./telemetry"
export { setLocale, getLocale, t } from "./core/i18n"

// 类型导出
export type {
  AgentOptions, AgentInstance, RunResult, RunEvent, TokenUsage,
  GenerateOptions, GenerateResult,
  ToolOptions, ToolInstance, ToolContext, ParamsDef, ParamSpec, JSONSchema,
  // V2.4 多模态
  MessageInput, ContentPart, TextPart, ImagePart, FilePart,
  Step, TaskStep, WaitStep, StepContext, ParallelStep, ConditionalStep,
  TeamOptions, TeamInstance, TeamRunResult, TeamRunEvent,
  PluginOptions, PluginInstance, PluginHooks, HookContext,
  ConfigOptions, ProviderEntry,
} from "./core/types"

// dao-ai/tools 内置工具
export { readFile, writeFile, listDir, runCommand, search } from "dao-ai/tools"
```
