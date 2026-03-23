/**
 * 道（Dao）— 错误分类
 *
 * 所有 Dao 错误的基类和子类。
 * 用户可以通过 instanceof 区分错误类型做不同处理。
 */

/** Dao 错误基类 */
export class DaoError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = "DaoError"
    this.code = code
  }
}

/** 模型调用失败（API 错误、网络错误等） */
export class ModelError extends DaoError {
  originalError?: Error

  constructor(message: string, originalError?: Error) {
    super(message, "MODEL_ERROR")
    this.name = "ModelError"
    this.originalError = originalError
  }
}

/** 工具执行失败 */
export class ToolError extends DaoError {
  toolName: string
  originalError?: Error

  constructor(message: string, toolName: string, originalError?: Error) {
    super(message, "TOOL_ERROR")
    this.name = "ToolError"
    this.toolName = toolName
    this.originalError = originalError
  }
}

/** 超时错误 */
export class TimeoutError extends DaoError {
  timeoutMs: number

  constructor(message: string, timeoutMs: number) {
    super(message, "TIMEOUT_ERROR")
    this.name = "TimeoutError"
    this.timeoutMs = timeoutMs
  }
}

import { t } from "./i18n.js"

/** 成本超限错误 */
export class CostLimitError extends DaoError {
  totalTokens: number
  limit: number

  constructor(totalTokens: number, limit: number) {
    super(t("error.costLimit", { totalTokens, limit }), "COST_LIMIT_ERROR")
    this.name = "CostLimitError"
    this.totalTokens = totalTokens
    this.limit = limit
  }
}
