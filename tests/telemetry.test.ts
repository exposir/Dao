/**
 * Telemetry 插件测试
 */

import { describe, it, expect, vi } from "vitest"
import { telemetryPlugin } from "../src/telemetry.js"

describe("telemetryPlugin()", () => {
  it("应该返回正确的插件结构", () => {
    const plugin = telemetryPlugin()
    expect(plugin.__type).toBe("plugin")
    expect(plugin.name).toBe("telemetry")
    expect(plugin.hooks).toBeDefined()
    expect(plugin.setup).toBeDefined()
  })

  it("应该包含所有必要的 hooks", () => {
    const plugin = telemetryPlugin()
    expect(plugin.hooks!.beforeInput).toBeTypeOf("function")
    expect(plugin.hooks!.beforeModelCall).toBeTypeOf("function")
    expect(plugin.hooks!.afterModelCall).toBeTypeOf("function")
    expect(plugin.hooks!.onComplete).toBeTypeOf("function")
    expect(plugin.hooks!.onError).toBeTypeOf("function")
  })

  it("应该接受自定义 serviceName", () => {
    const plugin = telemetryPlugin({ serviceName: "my-service" })
    expect(plugin.name).toBe("telemetry")
  })

  it("setup() 应该不崩溃（OTel 未安装时静默降级）", async () => {
    const plugin = telemetryPlugin()
    // setup 应该不抛错，无论 @opentelemetry/api 是否可用
    await expect(plugin.setup!({} as any)).resolves.not.toThrow()
  })

  it("hooks 在 tracer 为 null 时应该静默返回", async () => {
    const plugin = telemetryPlugin()
    // 不调用 setup()，tracer 为 null
    const ctx = {
      agent: {} as any,
      timestamp: Date.now(),
      store: {},
      skip: () => {},
    }
    // 应该不抛错
    await plugin.hooks!.beforeInput!({ ...ctx, message: "test" })
    await plugin.hooks!.beforeModelCall!({ ...ctx, prompt: "test", systemPrompt: "test", messages: [] })
    await plugin.hooks!.afterModelCall!({ ...ctx, response: {} })
    await plugin.hooks!.onComplete!({ ...ctx, result: { requestId: "x", output: "", turns: [], usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, duration: 0 } })
    await plugin.hooks!.onError!({ ...ctx, error: new Error("test") })
  })
})
