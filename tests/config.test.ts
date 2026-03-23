/**
 * config 单元测试
 */

import { describe, it, expect, beforeEach } from "vitest"
import { configure, getGlobalConfig, resetConfig } from "../src/core/config.js"

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

  it("defaultMaxTurns <= 0 应该抛错", () => {
    expect(() => configure({ defaultMaxTurns: 0 })).toThrow("defaultMaxTurns 必须大于 0")
    expect(() => configure({ defaultMaxTurns: -5 })).toThrow("defaultMaxTurns 必须大于 0")
  })

  it("空字符串 defaultModel 应该抛错", () => {
    expect(() => configure({ defaultModel: "" })).toThrow("defaultModel 不能为空字符串")
    expect(() => configure({ defaultModel: "   " })).toThrow("defaultModel 不能为空字符串")
  })

  it("getGlobalConfig() 返回的 globalPlugins 应与内部隔离", () => {
    const fakePlugin = { name: "p1", hooks: {} } as any
    configure({ globalPlugins: [fakePlugin] })

    const copy = getGlobalConfig()
    copy.globalPlugins!.push({ name: "injected", hooks: {} } as any)

    // 内部不应被污染
    expect(getGlobalConfig().globalPlugins).toHaveLength(1)
    expect(getGlobalConfig().globalPlugins![0].name).toBe("p1")
  })

  it("getGlobalConfig() 返回的 telemetry 应与内部隔离", () => {
    configure({ telemetry: { enabled: true } } as any)

    const copy = getGlobalConfig()
    ;(copy as any).telemetry.enabled = false

    // 内部不应被污染
    expect((getGlobalConfig() as any).telemetry.enabled).toBe(true)
  })
})
