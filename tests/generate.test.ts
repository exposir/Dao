/**
 * mockModel + generate 单元测试
 */

import { describe, it, expect } from "vitest"
import { agent, mockModel } from "../src/index.js"

describe("mockModel()", () => {
  it("应该按顺序返回预设响应", async () => {
    const bot = agent({
      modelProvider: mockModel(["你好", "再见"]),
    })

    const r1 = await bot.chat("第一句")
    expect(r1).toBe("你好")

    const r2 = await bot.chat("第二句")
    expect(r2).toBe("再见")
  })

  it("响应用完后应该抛错", async () => {
    const bot = agent({
      modelProvider: mockModel(["只有一条"]),
    })

    await bot.chat("第一句")  // 正常

    await expect(bot.chat("第二句")).rejects.toThrow("预设响应已用完")
  })

  it("loop 模式应该循环返回", async () => {
    const bot = agent({
      modelProvider: mockModel(["A", "B"], { loop: true }),
    })

    expect(await bot.chat("1")).toBe("A")
    expect(await bot.chat("2")).toBe("B")
    expect(await bot.chat("3")).toBe("A")  // 循环
    expect(await bot.chat("4")).toBe("B")
  })

  it("run() 应该返回完整 RunResult", async () => {
    const bot = agent({
      modelProvider: mockModel(["任务完成"]),
    })

    const result = await bot.run("执行任务")
    expect(result.output).toBe("任务完成")
    expect(result.usage.totalTokens).toBeGreaterThan(0)
    expect(result.duration).toBeGreaterThanOrEqual(0)
  })

  it("memory 模式应该保持上下文", async () => {
    const bot = agent({
      modelProvider: mockModel(["收到", "对的"], { loop: false }),
      memory: true,
    })

    await bot.chat("记住 X=1")
    const reply = await bot.chat("X 等于什么")
    expect(reply).toBe("对的")
  })

  it("应该支持 generate() 生成结构化对象", async () => {
    const bot = agent({
      modelProvider: mockModel([`{"name":"Alice","age":20}`]),
    })

    const result = await bot.generate("生成一个用户", {
      schema: {
        type: "object",
        properties: { name: { type: "string" }, age: { type: "number" } },
        required: ["name", "age"]
      }
    })

    expect(result.object.name).toBe("Alice")
    expect(result.object.age).toBe(20)
    expect(result.usage.totalTokens).toBeGreaterThan(0)
    expect(result.duration).toBeGreaterThanOrEqual(0)
  })
})
