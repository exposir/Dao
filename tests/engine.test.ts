/**
 * engine (Steps 引擎) 单元测试
 */

import { describe, it, expect, vi } from "vitest"
import { runSteps, AbortError } from "../src/engine.js"
import type { AgentInstance, StepContext } from "../src/core/types.js"

// mock agent
function mockAgent(): AgentInstance {
  return {
    chat: vi.fn(async (msg: string) => `回复: ${msg}`),
    run: vi.fn(async (task: string) => ({
      output: `完成: ${task}`,
      turns: [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      duration: 0,
    })),
    chatStream: vi.fn(async function* () { yield "mock" }),
    runStream: vi.fn(async function* () {}),
    clearMemory: vi.fn(),
    getConfig: vi.fn(() => ({})),
  }
}

describe("runSteps()", () => {
  it("应该按顺序执行字符串步骤", async () => {
    const agent = mockAgent()
    const results = await runSteps(["步骤一", "步骤二"], agent)

    expect(results).toHaveLength(2)
    expect(results[0].result).toBe("完成: 步骤一")
    expect(results[1].result).toBe("完成: 步骤二")
    expect(agent.run).toHaveBeenCalledTimes(2)
  })

  it("应该执行函数步骤", async () => {
    const agent = mockAgent()
    const fn = vi.fn(async (ctx: StepContext) => "函数结果")

    const results = await runSteps([fn], agent)
    expect(results[0].result).toBe("函数结果")
    expect(fn).toHaveBeenCalled()
  })

  it("应该并行执行 parallel 步骤", async () => {
    const agent = mockAgent()
    const results = await runSteps([
      { parallel: ["任务A", "任务B"] },
    ], agent)

    expect(results).toHaveLength(1)
    expect(results[0].result).toEqual(["完成: 任务A", "完成: 任务B"])
  })

  it("函数步骤应该能访问 ctx.lastResult", async () => {
    const agent = mockAgent()
    let captured: any = null

    const results = await runSteps([
      "第一步",
      async (ctx: StepContext) => {
        captured = ctx.lastResult
        return "第二步完成"
      },
    ], agent)

    expect(captured).toBe("完成: 第一步")
  })

  it("onStepStart/onStepEnd 回调应该被调用", async () => {
    const agent = mockAgent()
    const onStart = vi.fn()
    const onEnd = vi.fn()

    await runSteps(["步骤"], agent, onStart, onEnd)

    expect(onStart).toHaveBeenCalledWith("步骤", 0)
    expect(onEnd).toHaveBeenCalledWith("步骤", 0, "完成: 步骤")
  })

  it("ctx.abort() 应该抛出 AbortError", async () => {
    const agent = mockAgent()

    await expect(
      runSteps([
        (ctx: StepContext) => {
          ctx.abort("手动中止")
          return "不会到这里"
        },
      ], agent)
    ).rejects.toThrow(AbortError)
  })
})

describe("AbortError", () => {
  it("应该是 Error 的子类", () => {
    const err = new AbortError("测试")
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("AbortError")
    expect(err.message).toBe("测试")
  })
})
