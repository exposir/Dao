/**
 * 道（Dao）— 主入口
 *
 * 导出所有公开 API
 */

// 核心函数
export { agent } from "./agent.js"
export { tool } from "./tool.js"
export { configure } from "./core/config.js"
export { registerProvider } from "./core/model.js"
export { compileRules } from "./rules.js"
export { AbortError } from "./engine.js"
export { DaoError, ModelError, ToolError, TimeoutError } from "./core/errors.js"
export { plugin, logger } from "./plugin.js"
export { team } from "./team.js"
export { mockModel } from "./mock.js"

// 类型导出
export type {
  // Agent
  AgentOptions,
  AgentInstance,
  RunResult,
  RunEvent,
  TokenUsage,
  GenerateOptions,
  GenerateResult,
  // Tool
  ToolOptions,
  ToolInstance,
  ToolContext,
  ParamsDef,
  ParamSpec,
  JSONSchema,
  // Step
  Step,
  TaskStep,
  WaitStep,
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
} from "./core/types.js"
