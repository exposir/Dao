/**
 * config 单元测试
 */

import { describe, it, expect, beforeEach } from "vitest"
import { configure, getGlobalConfig, resetConfig } from "../src/config.js"

describe("configure()", () => {
  beforeEach(() => {
    resetConfig()
  })

  it("应该设置全局配置", () => {
    configure({ defaultModel: "deepseek/deepseek-chat" })
    expect(getGlobalConfig().defaultModel).toBe("deepseek/deepseek-chat")
  })

  it("应该合并配置", () => {
    configure({ defaultModel: "deepseek/deepseek-chat" })
    configure({ defaultMaxTurns: 30 })

    const config = getGlobalConfig()
    expect(config.defaultModel).toBe("deepseek/deepseek-chat")
    expect(config.defaultMaxTurns).toBe(30)
  })

  it("后设置的值应该覆盖先设置的", () => {
    configure({ defaultModel: "deepseek/deepseek-chat" })
    configure({ defaultModel: "openai/gpt-4o" })

    expect(getGlobalConfig().defaultModel).toBe("openai/gpt-4o")
  })

  it("resetConfig() 应该清空配置", () => {
    configure({ defaultModel: "deepseek/deepseek-chat", defaultMaxTurns: 30 })
    resetConfig()

    const config = getGlobalConfig()
    expect(config.defaultModel).toBeUndefined()
    expect(config.defaultMaxTurns).toBeUndefined()
  })

  it("初始配置应该是空对象", () => {
    const config = getGlobalConfig()
    expect(Object.keys(config)).toHaveLength(0)
  })
})
