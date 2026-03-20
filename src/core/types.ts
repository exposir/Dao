/**
 * 道（Dao）— 核心类型定义
 *
 * 所有公开类型集中在此文件，保持单一职责。
 */

import type { LanguageModel } from "ai"

// ============================================================
// 1. 工具类型
// ============================================================

/**
 * 参数定义
 * - 简写：{ key: "描述" } — 默认 string 类型
 * - 完整：{ key: { type: "number", description: "..." } }
 */
export type ParamsDef = Record<string, string | ParamSpec>

export interface ParamSpec {
  type: "string" | "number" | "boolean" | "array" | "object"
  description: string
  optional?: boolean
  items?: { type: string }
}

/** tool() 的输入参数 */
export interface ToolOptions {
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

/** tool() 返回的工具实例 */
export interface ToolInstance {
  __type: "tool"
  name: string
  description: string
  schema: JSONSchema
  execute: (params: any, ctx?: ToolContext) => Promise<any>
  confirm: boolean
}

/** 工具执行时的上下文 */
export interface ToolContext {
  /** 当前 Agent 实例 */
  agent: AgentInstance
  /** 中止执行 */
  abort: (reason?: string) => void
}

/** JSON Schema 类型（简化版） */
export interface JSONSchema {
  type: "object"
  properties: Record<string, any>
  required: string[]
}

// ============================================================
// 2. 步骤类型
// ============================================================

/** 步骤可以是以下任意类型 */
export type Step =
  | string
  | TaskStep
  | WaitStep
  | ParallelStep
  | ConditionalStep
  | ((ctx: StepContext) => any)

/** 任务步骤（带输出预期和校验） */
export interface TaskStep {
  /** 任务描述 */
  task: string
  /** 输出预期，拼入 prompt 引导 LLM 输出格式 */
  output?: string
  /** 输出校验函数，返回 true 通过，返回字符串为失败原因 */
  validate?: (result: string) => boolean | string
  /** 校验失败时的最大重试次数，默认 0（不重试） */
  maxRetries?: number
}

/** 等待步骤：暂停执行，等待 resume() 调用 */
export interface WaitStep {
  wait: true
  /** 等待描述（可选，仅供日志用） */
  reason?: string
}

export interface ParallelStep {
  parallel: (string | Step | (() => Promise<any>))[]
  /** 并发限制，默认不限 */
  concurrency?: number
}

export interface ConditionalStep {
  /** 条件：字符串（LLM 判断）或函数（代码判断） */
  if: string | ((ctx: StepContext) => boolean | Promise<boolean>)
  then: string | Step
  else?: string | Step
  /** 可选：失败时重试次数 */
  retry?: number
}

/** 步骤执行上下文 */
export interface StepContext {
  /** 上一步的执行结果 */
  lastResult: any
  /** 所有步骤的执行历史 */
  history: { step: Step; result: any }[]
  /** 当前 Agent 实例 */
  agent: AgentInstance
  /** 手动中止执行 */
  abort: (reason?: string) => void
}

// ============================================================
// 3. Agent 类型
// ============================================================

/** agent() 的输入参数 */
export interface AgentOptions {
  /** 角色描述，会被注入到 system prompt 中 */
  role?: string
  /** 目标：告诉 LLM 它要完成什么 */
  goal?: string
  /** 背景：告诉 LLM 它为什么能完成 */
  background?: string
  /** 模型，格式为 "provider/model" */
  model?: string
  /** 可用工具列表 */
  tools?: ToolInstance[]
  /** 步骤列表 */
  steps?: Step[]
  /** 规则约束 */
  rules?: {
    focus?: string[]
    reject?: string[]
  }
  /**
   * 是否开启记忆
   * @default false
   */
  memory?: boolean
  /**
   * 最大执行轮次
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

  /** 插件列表 */
  plugins?: PluginInstance[]

  // === V1.1：生产可靠性 ===

  /**
   * 重试配置
   * AI SDK 内置指数退避和 429 自动等待
   * @default { maxRetries: 2 }
   */
  retry?: {
    maxRetries?: number
  }
  /**
   * 超时时间（毫秒）
   * 超时后抛出 TimeoutError
   */
  timeout?: number
  /**
   * 单次模型调用的最大 token 数
   */
  maxTokens?: number

  // === 预留扩展点 ===

  /** 是否开启流式输出 */
  stream?: boolean
  /** 工具确认回调，工具 confirm: true 时调用 */
  onConfirm?: (toolName: string, params: any) => Promise<boolean>
  /** 备用模型，主模型失败后自动切换 */
  fallbackModel?: string
  /** 上下文窗口配置 @planned V2.0 */
  contextWindow?: {
    maxTokens?: number
    strategy?: "truncate" | "summarize"
  }
  /** 自定义模型提供者（测试注入 mock） */
  modelProvider?: LanguageModel
  /** 可委派的 Agent 列表，自动注入 delegate 工具 */
  delegates?: Record<string, AgentInstance>
}

/** agent() 返回的实例 */
export interface AgentInstance {
  /** 对话模式：单轮问答，保持上下文 */
  chat(message: string): Promise<string>
  /** 任务模式：执行任务直到完成 */
  run(task: string): Promise<RunResult>
  /** 流式对话 */
  chatStream(message: string): AsyncIterable<string>
  /** 流式任务执行 */
  runStream(task: string): AsyncIterable<RunEvent>
  /** 恢复被 wait 步骤暂停的执行，可传入数据供后续步骤使用 */
  resume(data?: any): void
  /** 清除记忆 */
  clearMemory(): void
  /** 获取当前配置 */
  getConfig(): AgentOptions
}

/** 执行结果 */
export interface RunResult {
  /** 最终输出文本 */
  output: string
  /** 模型调用轮次记录 */
  turns: { turn: string; result: any }[]
  /** 使用的 token 数 */
  usage: TokenUsage
  /** 执行耗时（毫秒） */
  duration: number
}

/** Token 用量 */
export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/**
 * 流式事件
 */
export type RunEvent =
  | { type: "text"; data: string }
  | { type: "done"; data: null }
  | { type: "step_start"; data: { step: string; index: number } }
  | { type: "step_end"; data: { step: string; index: number; result: any } }
  | { type: "tool_call"; data: { tool: string; params: any; result: any } }

// ============================================================
// 4. Team 类型
// ============================================================

/** team() 的输入参数 */
export interface TeamOptions {
  /** 调度 Agent（可选） */
  lead?: AgentInstance
  /** 团队成员 */
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

/** team() 返回的实例 */
export interface TeamInstance {
  run(task: string): Promise<TeamRunResult>
  runStream(task: string): AsyncIterable<TeamRunEvent>
  getMembers(): Record<string, AgentInstance>
}

/** 团队执行结果 */
export interface TeamRunResult {
  output: string
  memberResults: Record<string, RunResult[]>
  usage: TokenUsage
  duration: number
}

/**
 * 团队流式事件。当前仅透传 lead 的 text/done 事件，member 固定为 "lead"。
 * @future 计划支持 delegate / member_start / member_end 等团队级事件
 */
export interface TeamRunEvent {
  type: "text" | "done"
  member: string
  data: any
}

// ============================================================
// 5. 插件类型
// ============================================================

/** plugin() 的输入参数 */
export interface PluginOptions {
  /** 插件名称 */
  name: string
  /** 插件初始化函数 */
  setup?: (agent: AgentInstance) => void | Promise<void>
  /** Hook 函数 */
  hooks?: PluginHooks
}

/** 插件 hooks 定义 */
export interface PluginHooks {
  beforeInput?: (ctx: HookContext & { message: string }) => void | Promise<void>
  beforeModelCall?: (ctx: HookContext & { prompt: string }) => void | Promise<void>
  afterModelCall?: (ctx: HookContext & { response: any }) => void | Promise<void>
  beforeToolCall?: (ctx: HookContext & { tool: string; params: any }) => void | Promise<void>
  afterToolCall?: (ctx: HookContext & { tool: string; result: any }) => void | Promise<void>
  afterStep?: (ctx: HookContext & { step: Step; result: any }) => void | Promise<void>
  onComplete?: (ctx: HookContext & { result: RunResult }) => void | Promise<void>
  onError?: (ctx: HookContext & { error: Error }) => void | Promise<void>
}

/** Hook 上下文 */
export interface HookContext {
  /** 当前 Agent 实例 */
  agent: AgentInstance
  /** 事件时间戳 */
  timestamp: number
  /** 插件数据存储 */
  store: Record<string, any>
  /**
   * 跳过后续核心行为
   * 所有 hook 都可调用，但仅在 beforeToolCall / beforeModelCall 中生效
   */
  skip: () => void
}

/** plugin() 返回的插件实例 */
export interface PluginInstance {
  __type: "plugin"
  name: string
  setup?: (agent: AgentInstance) => void | Promise<void>
  hooks: PluginHooks
}

// ============================================================
// 6. 全局配置类型
// ============================================================

/** configure() 的输入参数 */
export interface ConfigOptions {
  /** 默认模型 */
  defaultModel?: string
  /**
   * 默认最大轮次
   * @default 50
   */
  defaultMaxTurns?: number

  // === 预留扩展点 ===

  /** 默认是否开启流式 */
  defaultStream?: boolean
  /** 全局插件 */
  globalPlugins?: PluginInstance[]
  /** 可观测性配置 @planned V2.0 */
  telemetry?: {
    enabled?: boolean
    exporter?: (event: any) => void
  }
  /** 成本上限 @planned V2.0 */
  maxCostPerRun?: number
}

// ============================================================
// 7. 模型层类型
// ============================================================

/** Provider 注册表条目 */
export interface ProviderEntry {
  /** provider 工厂函数 */
  create: (apiKey: string) => any | Promise<any>
  /** 环境变量名 */
  envKey: string
  /** 默认模型 */
  defaultModel: string
}
