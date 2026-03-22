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
    generate: vi.fn(),
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

describe("store 共享机制", () => {
  it("同名插件应该共享同一个 store", async () => {
    const agent = mockAgent()
    const p1 = plugin({
      name: "counter",
      hooks: {
        beforeInput: (ctx: any) => {
          ctx.store.count = (ctx.store.count ?? 0) + 1
        },
      },
    })
    const p2 = plugin({
      name: "counter",  // 同名
      hooks: {
        afterModelCall: (ctx: any) => {
          ctx.store.count = (ctx.store.count ?? 0) + 10
        },
      },
    })

    const pm = new PluginManager([p1, p2])
    await pm.emit("beforeInput", agent, { message: "hello" })
    await pm.emit("afterModelCall", agent, { response: { text: "hi", usage: {} } })

    // 再次触发 p1，检查 store 是否被 p2 修改过
    await pm.emit("beforeInput", agent, { message: "hello again" })

    // p1 第一次 +1 = 1，p2 +10 = 11，p1 第二次 +1 = 12
    // 通过第三次 emit 验证 store 确实共享
    let finalStoreCount = 0
    const p3 = plugin({
      name: "counter",
      hooks: {
        beforeInput: (ctx: any) => {
          finalStoreCount = ctx.store.count
        }
      }
    })
    const pm2 = new PluginManager([p1, p2, p3])
    await pm2.emit("beforeInput", agent, { message: "init" })
    await pm2.emit("afterModelCall", agent, { response: { text: "hi", usage: { promptTokens:0, completionTokens:0, totalTokens:0 } } })
    await pm2.emit("beforeInput", agent, { message: "check" })
    
    // 第三次 emit ("beforeInput") 时，p1 再 +1 = 12
    // 但当轮到 p3 执行 beforeInput 时，获取到的是经过 p1 修改后的 12
    expect(finalStoreCount).toBe(12)
  })

  it("不同名插件应该有独立的 store", async () => {
    const agent = mockAgent()
    let storeA: any = null
    let storeB: any = null

    const pA = plugin({
      name: "pluginA",
      hooks: {
        beforeInput: (ctx: any) => {
          ctx.store.value = "A"
          storeA = { ...ctx.store }
        },
      },
    })
    const pB = plugin({
      name: "pluginB",
      hooks: {
        beforeInput: (ctx: any) => {
          storeB = { ...ctx.store }
        },
      },
    })

    const pm = new PluginManager([pA, pB])
    await pm.emit("beforeInput", agent, { message: "hello" })

    // pluginA 的 store 有 value
    expect(storeA.value).toBe("A")
    // pluginB 的 store 是独立的，不应有 pluginA 的数据
    expect(storeB.value).toBeUndefined()
  })

  it("store 数据应该跨 hook 调用持久化", async () => {
    const agent = mockAgent()
    let finalCount = 0

    const p = plugin({
      name: "persistent",
      hooks: {
        beforeInput: (ctx: any) => {
          ctx.store.count = (ctx.store.count ?? 0) + 1
        },
        onComplete: (ctx: any) => {
          finalCount = ctx.store.count
        },
      },
    })

    const pm = new PluginManager([p])
    await pm.emit("beforeInput", agent, { message: "1" })
    await pm.emit("beforeInput", agent, { message: "2" })
    await pm.emit("beforeInput", agent, { message: "3" })
    await pm.emit("onComplete", agent, { result: { output: "", turns: [], usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, duration: 0 } })

    expect(finalCount).toBe(3)
  })
})
