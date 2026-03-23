/**
 * requestId 测试
 */

import { describe, it, expect } from "vitest"
import { agent, mockModel } from "../src/index.js"

describe("RunResult.requestId", () => {
  it("run() 结果应该包含 requestId", async () => {
    const bot = agent({
      modelProvider: mockModel(["hello"]),
    })
    const result = await bot.run("test")
    expect(result.requestId).toBeDefined()
    expect(typeof result.requestId).toBe("string")
    expect(result.requestId.length).toBeGreaterThan(0)
  })

  it("requestId 应该是 UUID 格式", async () => {
    const bot = agent({
      modelProvider: mockModel(["hello"]),
    })
    const result = await bot.run("test")
    // UUID v4 格式: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    expect(result.requestId).toMatch(uuidRegex)
  })

  it("每次执行应该生成不同的 requestId", async () => {
    const bot = agent({
      modelProvider: mockModel(["a", "b"], { loop: true }),
    })
    const result1 = await bot.run("test1")
    const result2 = await bot.run("test2")
    expect(result1.requestId).not.toBe(result2.requestId)
  })
})
