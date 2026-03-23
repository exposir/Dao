/**
 * 道（Dao）— 全局配置
 *
 * configure() 设置全局默认值，agent() 创建时读取。
 */

import type { ConfigOptions } from "./types.js"

/** 全局配置（内部状态） */
let globalConfig: ConfigOptions = {}

/**
 * 设置全局配置
 *
 * @example
 * ```typescript
 * configure({
 *   defaultModel: "deepseek/deepseek-chat",
 *   defaultMaxTurns: 30,
 * })
 * ```
 */
export function configure(options: ConfigOptions): void {
  if (options.defaultMaxTurns !== undefined && options.defaultMaxTurns <= 0) {
    throw new Error("configure(): defaultMaxTurns 必须大于 0")
  }
  if (options.defaultModel !== undefined && options.defaultModel.trim() === "") {
    throw new Error("configure(): defaultModel 不能为空字符串")
  }
  globalConfig = { ...globalConfig, ...options }
}

/** 获取当前全局配置（返回副本，防止外部直接修改内部状态） */
export function getGlobalConfig(): ConfigOptions {
  const copy = { ...globalConfig }
  // 隔离嵌套数组引用
  if (copy.globalPlugins) copy.globalPlugins = [...copy.globalPlugins]
  return copy
}

/** 重置全局配置（测试用） */
export function resetConfig(): void {
  globalConfig = {}
}
