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

  it("应该支持嵌套对象 schema", async () => {
    const bot = agent({
      modelProvider: mockModel([`{"user":{"name":"Bob","address":{"city":"北京"}}}`]),
    })

    const result = await bot.generate("生成嵌套用户", {
      schema: {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              name: { type: "string" },
              address: {
                type: "object",
                properties: { city: { type: "string" } },
              },
            },
          },
        },
      }
    })

    expect(result.object.user.name).toBe("Bob")
    expect(result.object.user.address.city).toBe("北京")
  })

  it("应该支持数组 schema", async () => {
    const bot = agent({
      modelProvider: mockModel([`{"items":[{"id":1},{"id":2},{"id":3}]}`]),
    })

    const result = await bot.generate("生成列表", {
      schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { type: "object", properties: { id: { type: "number" } } },
          },
        },
      }
    })

    expect(result.object.items).toHaveLength(3)
    expect(result.object.items[0].id).toBe(1)
    expect(result.object.items[2].id).toBe(3)
  })

  it("generate() 不应使用 memory", async () => {
    const bot = agent({
      modelProvider: mockModel([
        `{"x":1}`,
        `{"x":2}`,
      ]),
      memory: true,
    })

    await bot.generate("第一次", {
      schema: { type: "object", properties: { x: { type: "number" } } }
    })

    // generate 是无状态的，不应影响后续 chat
    // 第二次 generate 仍应正常工作
    const r2 = await bot.generate("第二次", {
      schema: { type: "object", properties: { x: { type: "number" } } }
    })
    expect(r2.object.x).toBe(2)
  })
})
