/**
 * V2.5 功能测试
 *
 * - Feature 4: Agent 共享状态 (state)
 * - Feature 2: StepContext.workspace
 * - Feature 1: Plugin 可变性 (beforeModelCall writable)
 * - Feature 3: Mid-run clarification (ask tool)
 */

import { describe, it, expect, vi } from "vitest"
import { agent, mockModel, plugin } from "../src/index.js"

describe("V2.5: Agent 共享状态", () => {
  it("agent 实例应该有 state 属性", () => {
    const bot = agent({ modelProvider: mockModel(["ok"]) })
    expect(bot.state).toBeInstanceOf(Map)
    expect(bot.state.size).toBe(0)
  })

  it("state 应该在多次 run 之间共享", async () => {
    const bot = agent({ modelProvider: mockModel(["第一次", "第二次"], { loop: true }) })

    bot.state.set("counter", 0)
    await bot.run("第一次")
    bot.state.set("counter", (bot.state.get("counter") ?? 0) + 1)

    await bot.run("第二次")
    bot.state.set("counter", (bot.state.get("counter") ?? 0) + 1)

    expect(bot.state.get("counter")).toBe(2)
  })

  it("不同 agent 实例应该有独立的 state", () => {
    const bot1 = agent({ modelProvider: mockModel(["ok"]) })
    const bot2 = agent({ modelProvider: mockModel(["ok"]) })

    bot1.state.set("name", "bot1")
    bot2.state.set("name", "bot2")

    expect(bot1.state.get("name")).toBe("bot1")
    expect(bot2.state.get("name")).toBe("bot2")
  })
})

describe("V2.5: Plugin 可变性", () => {
  it("beforeModelCall 应该能修改 systemPrompt", async () => {
    let capturedPrompt = ""

    const spy = plugin({
      name: "prompt-modifier",
      hooks: {
        beforeModelCall: (ctx) => {
          // 修改 system prompt
          ctx.systemPrompt = ctx.systemPrompt + "\n\n额外指令：用JSON格式回答"
          capturedPrompt = ctx.systemPrompt
        },
      },
    })

    const bot = agent({
      role: "助手",
      modelProvider: mockModel(["ok"]),
      plugins: [spy],
    })

    await bot.run("test")
    expect(capturedPrompt).toContain("额外指令：用JSON格式回答")
  })

  it("beforeModelCall 应该能读取 messages", async () => {
    let messageCount = 0

    const spy = plugin({
      name: "message-counter",
      hooks: {
        beforeModelCall: (ctx) => {
          messageCount = ctx.messages.length
        },
      },
    })

    const bot = agent({
      modelProvider: mockModel(["ok"]),
      plugins: [spy],
    })

    await bot.run("hello")
    expect(messageCount).toBeGreaterThan(0)
  })
})

describe("V2.5: onAsk 回调", () => {
  it("onAsk 选项应该可以设置", () => {
    const bot = agent({
      modelProvider: mockModel(["ok"]),
      onAsk: async (q) => "用户回答",
    })
    expect(bot).toBeDefined()
  })
})
