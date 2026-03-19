# API 设计文档

本文档定义 Dao 框架所有公开 API 的完整类型、参数说明和默认行为。

---

## 1. agent(options) → AgentInstance

创建一个 Agent。

### 类型定义

```typescript
interface AgentOptions {
  /** 角色描述，会被注入到 system prompt 中 */
  role?: string

  /** 模型，格式为 "provider/model" */
  model?: string

  /** 
   * 可用工具列表
   * 支持普通函数（自动推导 schema）或 tool() 返回的工具对象
   */
  tools?: (Function | ToolInstance)[]

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
}
```

### Step 类型

```typescript
/** 步骤可以是以下任意类型 */
type Step =
  | string                          // 字符串指令，交给 LLM 执行
  | ParallelStep                    // 并行执行
  | ConditionalStep                 // 条件分支
  | RetryStep                       // 重试
  | WaitStep                        // 暂停等待（suspend/resume）
  | ((ctx: StepContext) => any)     // 自定义函数

interface ParallelStep {
  parallel: (string | Step | (() => Promise<any>))[]
}

interface ConditionalStep {
  /** 条件：字符串（LLM 判断）或函数（代码判断） */
  if: string | ((ctx: StepContext) => boolean | Promise<boolean>)
  then: string | Step
  else?: string | Step
}

interface RetryStep {
  /** 要重试的步骤 */
  step?: string | Step
  /** 最大重试次数 */
  retry: number
}

interface WaitStep {
  /** 等待提示信息，展示给用户 */
  wait: string
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

  /** 插件列表（团队级别） */
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
// 自动生成的工具示意
tool({
  name: "delegate_to_planner",
  description: "委派任务给架构师。架构师的职责：分析需求、制定方案、拆分任务",
  params: { task: String },
  run: ({ task }) => planner.run(task),
})
```

---

## 3. tool(options) → ToolInstance

显式定义一个工具。

### 类型定义

```typescript
interface ToolOptions {
  /** 工具名称 */
  name: string

  /** 工具描述，会展示给 LLM */
  description: string

  /** 
   * 参数定义
   * 简写：{ key: Type }
   * 完整：使用 Zod schema（可选）
   */
  params: Record<string, any> | ZodSchema

  /** 执行函数 */
  run: (params: any, ctx?: ToolContext) => any | Promise<any>

  /**
   * 执行前是否需要用户确认
   * @default false
   */
  confirm?: boolean

  /**
   * 是否在确认时展示参数
   * @default true
   */
  showParams?: boolean
}

interface ToolContext {
  /** 当前 Agent 实例 */
  agent: AgentInstance

  /** 中止执行 */
  abort: (reason?: string) => void
}

type ToolInstance = {
  /** 工具标识 */
  __type: "tool"
  name: string
  description: string
  schema: JSONSchema
  execute: (params: any) => Promise<any>
  confirm: boolean
}
```

### 普通函数自动推导

当 `tools` 中传入普通函数时，框架自动推导：

```typescript
/**
 * 读取文件内容
 * @param path 文件路径
 * @returns 文件内容字符串
 */
function readFile(path: string): string {
  return fs.readFileSync(path, "utf-8")
}

// 框架自动推导为：
// name: "readFile"
// description: "读取文件内容"（从 JSDoc 提取）
// params: { path: { type: "string", description: "文件路径" } }
```

推导规则：
1. `name` ← 函数名
2. `description` ← JSDoc 第一行注释
3. `params` ← TypeScript 参数类型 + `@param` 注释
4. `run` ← 函数本身

---

## 4. plugin(options) → PluginInstance

定义一个插件。

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
    beforeInput?: (ctx: HookContext) => void | Promise<void>

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
}
```

---

## 5. 全局配置

```typescript
import { configure } from "dao"

configure({
  /** 默认模型（所有 agent 不指定 model 时使用） */
  defaultModel: "deepseek/deepseek-chat",

  /**
   * 默认最大轮次
   * @default 50
   */
  defaultMaxTurns: 50,

  /**
   * 默认是否开启流式
   * @default true
   */
  defaultStream: true,

  /**
   * 全局插件（所有 agent 自动加载）
   */
  globalPlugins: [logger()],
})
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

// dao/tools 内置工具
export { readFile, writeFile, listDir } from "dao/tools"

// dao/plugins 内置插件
export { logger } from "dao/plugins"
```
