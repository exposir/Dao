/**
 * i18n 测试
 */

import { describe, it, expect, afterEach } from "vitest"
import { t, setLocale, getLocale } from "../src/core/i18n.js"

describe("i18n", () => {
  afterEach(() => {
    setLocale("zh") // 每个测试后重置为中文
  })

  it("默认语言应该是中文", () => {
    expect(getLocale()).toBe("zh")
  })

  it("t() 应该返回中文翻译", () => {
    const msg = t("error.noModelShort")
    expect(msg).toBe("未指定模型。")
  })

  it("setLocale('en') 后 t() 应该返回英文翻译", () => {
    setLocale("en")
    expect(getLocale()).toBe("en")
    const msg = t("error.noModelShort")
    expect(msg).toBe("No model specified.")
  })

  it("t() 应该支持参数替换", () => {
    const msg = t("error.costLimit", { totalTokens: 5000, limit: 1000 })
    expect(msg).toContain("5000")
    expect(msg).toContain("1000")
  })

  it("setLocale('en') 后参数替换也应该生效", () => {
    setLocale("en")
    const msg = t("error.costLimit", { totalTokens: 5000, limit: 1000 })
    expect(msg).toBe("Token usage (5000) exceeds limit (1000)")
  })

  it("未知 key 应该返回 key 本身", () => {
    expect(t("unknown.key")).toBe("unknown.key")
  })

  it("所有核心错误 key 都应该有中英文翻译", () => {
    const keys = [
      "error.noModel",
      "error.noModelShort",
      "error.costLimit",
      "error.timeout",
      "error.modelFail",
      "error.toolFail",
      "error.emptyModel",
      "error.maxTurns",
      "error.abort",
      "error.mcpNeedDep",
      "error.mcpNeedTransport",
      "error.toolConfirm",
      "error.waitNeedResume",
      "error.unknownStep",
      "error.mockExhausted",
    ]
    for (const key of keys) {
      // 中文
      setLocale("zh")
      expect(t(key)).not.toBe(key)
      // 英文
      setLocale("en")
      expect(t(key)).not.toBe(key)
    }
  })
})
