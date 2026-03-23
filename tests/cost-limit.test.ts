/**
 * 成本上限 (maxCostPerRun) 单元测试
 */

import { describe, it, expect } from "vitest"
import { agent, mockModel, CostLimitError } from "../src/index.js"

describe("maxCostPerRun", () => {
  it("token 用量超过上限时应抛出 CostLimitError", async () => {
    // mockModel 每次调用的 token = 文本长度 * 2（input + output）
    // "这是一个很长的响应文本" = 10 字符 → usage ≈ 20 tokens
    const bot = agent({
      modelProvider: mockModel(["这是一个很长的响应文本用来超过限制的"]),
      maxCostPerRun: 1, // 极低上限，一定会超
    })

    await expect(bot.chat("测试")).rejects.toThrow(CostLimitError)
  })

  it("token 用量未超限时应正常返回", async () => {
    const bot = agent({
      modelProvider: mockModel(["ok"]),
      maxCostPerRun: 10000, // 足够高
    })

    const reply = await bot.chat("测试")
    expect(reply).toBe("ok")
  })

  it("未设置 maxCostPerRun 时不应检查", async () => {
    const bot = agent({
      modelProvider: mockModel(["一个正常的响应"]),
      // 不设 maxCostPerRun
    })

    const reply = await bot.chat("测试")
    expect(typeof reply).toBe("string")
  })

  it("CostLimitError 应包含 totalTokens 和 limit", async () => {
    const bot = agent({
      modelProvider: mockModel(["超限文本"]),
      maxCostPerRun: 1,
    })

    try {
      await bot.chat("测试")
      expect.unreachable("应该抛错")
    } catch (err) {
      expect(err).toBeInstanceOf(CostLimitError)
      const costErr = err as InstanceType<typeof CostLimitError>
      expect(costErr.totalTokens).toBeGreaterThan(1)
      expect(costErr.limit).toBe(1)
      expect(costErr.code).toBe("COST_LIMIT_ERROR")
    }
  })

  it("run() 也应受 maxCostPerRun 限制", async () => {
    const bot = agent({
      modelProvider: mockModel(["超限"]),
      maxCostPerRun: 1,
    })

    await expect(bot.run("测试")).rejects.toThrow(CostLimitError)
  })
})
