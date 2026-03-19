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
  globalConfig = { ...globalConfig, ...options }
}

/** 获取当前全局配置（内部使用） */
export function getGlobalConfig(): ConfigOptions {
  return globalConfig
}

/** 重置全局配置（测试用） */
export function resetConfig(): void {
  globalConfig = {}
}
