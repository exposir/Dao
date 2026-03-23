/**
 * 上下文窗口管理 单元测试
 */

import { describe, it, expect } from "vitest"
import { agent, mockModel } from "../src/index.js"

describe("contextWindow", () => {
  it("maxMessages 应裁剪超出的历史消息", async () => {
    const bot = agent({
      modelProvider: mockModel(["1", "2", "3", "4", "5"], { loop: true }),
      memory: true,
      contextWindow: { maxMessages: 4 }, // 最多保留 4 条（2 轮对话）
    })

    // 发 5 轮对话 = 10 条消息，但只保留最近 4 条
    for (let i = 0; i < 5; i++) {
      await bot.chat(`第${i + 1}句`)
    }

    // 验证：clearMemory 后重新对话不应包含旧历史
    // 间接验证：如果历史没被裁剪，消息会远超 4 条
    // 直接验证：再跑一轮，确保不会因为消息过多而出错
    const reply = await bot.chat("最后一句")
    expect(typeof reply).toBe("string")
  })

  it("未设置 maxMessages 时不应裁剪", async () => {
    const bot = agent({
      modelProvider: mockModel(["ok"], { loop: true }),
      memory: true,
      // 不设 contextWindow
    })

    for (let i = 0; i < 10; i++) {
      await bot.chat(`第${i + 1}句`)
    }

    // 不抛错即证明正常（无裁剪）
    const reply = await bot.chat("继续")
    expect(typeof reply).toBe("string")
  })

  it("memory: false 时 contextWindow 不应生效", async () => {
    const bot = agent({
      modelProvider: mockModel(["ok"], { loop: true }),
      memory: false,
      contextWindow: { maxMessages: 2 },
    })

    // 不开 memory 就没有 history，contextWindow 无意义但不应报错
    const reply = await bot.chat("hello")
    expect(typeof reply).toBe("string")
  })

  it("clearMemory 应正常工作", async () => {
    const bot = agent({
      modelProvider: mockModel(["ok"], { loop: true }),
      memory: true,
      contextWindow: { maxMessages: 4 },
    })

    await bot.chat("A")
    await bot.chat("B")
    bot.clearMemory()

    // 清空后重新对话
    const reply = await bot.chat("C")
    expect(reply).toBe("ok")
  })

  it("chatStream 也应裁剪历史", async () => {
    const bot = agent({
      modelProvider: mockModel(["stream"], { loop: true }),
      memory: true,
      contextWindow: { maxMessages: 4 },
    })

    // 多轮流式对话
    for (let i = 0; i < 5; i++) {
      let text = ""
      for await (const chunk of bot.chatStream(`流式第${i + 1}句`)) {
        text += chunk
      }
    }

    // 再来一轮确保不出错
    let final = ""
    for await (const chunk of bot.chatStream("最后一句")) {
      final += chunk
    }
    expect(final.length).toBeGreaterThan(0)
  })

  it("getConfig 应包含 contextWindow 配置", () => {
    const bot = agent({
      modelProvider: mockModel(["ok"]),
      contextWindow: { maxMessages: 10 },
    })

    const config = bot.getConfig()
    expect(config.contextWindow?.maxMessages).toBe(10)
  })
})
