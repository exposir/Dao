/**
 * plugin 系统单元测试
 */

import { describe, it, expect, vi } from "vitest"
import { plugin, PluginManager, logger } from "../src/plugin.js"
import type { AgentInstance, PluginInstance } from "../src/core/types.js"

// mock agent
function mockAgent(): AgentInstance {
  return {
    chat: vi.fn(async () => "mock"),
    run: vi.fn(async () => ({ output: "mock", turns: [], usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, duration: 0 })),
    chatStream: vi.fn(async function* () { yield "mock" }),
    runStream: vi.fn(async function* () {}),
    resume: vi.fn(),
    clearMemory: vi.fn(),
    getConfig: vi.fn(() => ({})),
  }
}

describe("plugin()", () => {
  it("应该创建 PluginInstance", () => {
    const p = plugin({ name: "test" })
    expect(p.__type).toBe("plugin")
    expect(p.name).toBe("test")
  })

  it("应该包含 hooks", () => {
    const hook = vi.fn()
    const p = plugin({
      name: "test",
      hooks: { beforeInput: hook },
    })
    expect(p.hooks.beforeInput).toBe(hook)
  })
})

describe("PluginManager", () => {
  it("hasPlugins 应该正确检测", () => {
    const pm1 = new PluginManager([])
    expect(pm1.hasPlugins).toBe(false)

    const pm2 = new PluginManager([plugin({ name: "test" })])
    expect(pm2.hasPlugins).toBe(true)
  })

  it("setup 应该调用所有插件的 setup", async () => {
    const setup1 = vi.fn()
    const setup2 = vi.fn()
    const pm = new PluginManager([
      plugin({ name: "p1", setup: setup1 }),
      plugin({ name: "p2", setup: setup2 }),
    ])

    const agent = mockAgent()
    await pm.setup(agent)

    expect(setup1).toHaveBeenCalledWith(agent)
    expect(setup2).toHaveBeenCalledWith(agent)
  })

  it("emit 应该调用对应的 hook", async () => {
    const hook = vi.fn()
    const pm = new PluginManager([
      plugin({ name: "test", hooks: { beforeInput: hook } }),
    ])

    const agent = mockAgent()
    await pm.emit("beforeInput", agent, { message: "hello" })

    expect(hook).toHaveBeenCalledTimes(1)
  })

  it("skip() 应该中止后续 hook", async () => {
    const hook1 = vi.fn((ctx: any) => ctx.skip())
    const hook2 = vi.fn()
    const pm = new PluginManager([
      plugin({ name: "p1", hooks: { beforeInput: hook1 } }),
      plugin({ name: "p2", hooks: { beforeInput: hook2 } }),
    ])

    const agent = mockAgent()
    const { skipped } = await pm.emit("beforeInput", agent, { message: "hello" })

    expect(skipped).toBe(true)
    expect(hook1).toHaveBeenCalled()
    expect(hook2).not.toHaveBeenCalled()
  })
})

describe("logger()", () => {
  it("应该创建 logger 插件", () => {
    const l = logger()
    expect(l.__type).toBe("plugin")
    expect(l.name).toBe("logger")
  })

  it("应该包含所有 hooks", () => {
    const l = logger()
    expect(l.hooks.beforeInput).toBeDefined()
    expect(l.hooks.beforeModelCall).toBeDefined()
    expect(l.hooks.afterModelCall).toBeDefined()
    expect(l.hooks.beforeToolCall).toBeDefined()
    expect(l.hooks.afterToolCall).toBeDefined()
    expect(l.hooks.onComplete).toBeDefined()
    expect(l.hooks.onError).toBeDefined()
  })
})
