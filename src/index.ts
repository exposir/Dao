/**
 * 道（Dao）— 主入口
 *
 * 导出所有公开 API
 */

// 核心函数
export { agent } from "./agent.js"
export { tool } from "./tool.js"
export { configure } from "./config.js"
export { registerProvider } from "./model.js"
export { compileRules } from "./rules.js"
export { AbortError } from "./engine.js"

// 类型导出
export type {
  // Agent
  AgentOptions,
  AgentInstance,
  RunResult,
  RunEvent,
  TokenUsage,
  // Tool
  ToolOptions,
  ToolInstance,
  ToolContext,
  ParamsDef,
  ParamSpec,
  JSONSchema,
  // Step
  Step,
  StepContext,
  ParallelStep,
  ConditionalStep,
  // Team
  TeamOptions,
  TeamInstance,
  TeamRunResult,
  TeamRunEvent,
  // Plugin
  PluginOptions,
  PluginInstance,
  PluginHooks,
  HookContext,
  // Config
  ConfigOptions,
  // Model
  ProviderEntry,
} from "./types.js"
