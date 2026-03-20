/**
 * engine (Steps 引擎) 单元测试
 */

import { describe, it, expect, vi } from "vitest"
import { runSteps, AbortError } from "../src/engine.js"
import type { AgentInstance, StepContext, RunResult } from "../src/core/types.js"

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
    resume: vi.fn(),
    clearMemory: vi.fn(),
    getConfig: vi.fn(() => ({})),
  }
}

// mock executeTask（模拟 agent.ts 传入的回调，直接走 runLoop 跳过 steps）
function mockExecuteTask(task: string): Promise<RunResult> {
  return Promise.resolve({
    output: `完成: ${task}`,
    turns: [],
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    duration: 0,
  })
}

describe("runSteps()", () => {
  it("应该按顺序执行字符串步骤", async () => {
    const agent = mockAgent()
    const results = await runSteps(["步骤一", "步骤二"], agent, mockExecuteTask)

    expect(results).toHaveLength(2)
    expect(results[0].result).toBe("完成: 步骤一")
    expect(results[1].result).toContain("步骤二")
    // 字符串步骤走 executeTask 回调，不走 agent.run()
    expect(agent.run).not.toHaveBeenCalled()
  })

  it("应该执行函数步骤", async () => {
    const agent = mockAgent()
    const fn = vi.fn(async (ctx: StepContext) => "函数结果")

    const results = await runSteps([fn], agent, mockExecuteTask)
    expect(results[0].result).toBe("函数结果")
    expect(fn).toHaveBeenCalled()
  })

  it("应该并行执行 parallel 步骤", async () => {
    const agent = mockAgent()
    const results = await runSteps([
      { parallel: ["任务A", "任务B"] },
    ], agent, mockExecuteTask)

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
    ], agent, mockExecuteTask)

    expect(captured).toBe("完成: 第一步")
  })

  it("onStepStart/onStepEnd 回调应该被调用", async () => {
    const agent = mockAgent()
    const onStart = vi.fn()
    const onEnd = vi.fn()

    await runSteps(["步骤"], agent, mockExecuteTask, onStart, onEnd)

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
      ], agent, mockExecuteTask)
    ).rejects.toThrow(AbortError)
  })

  it("字符串步骤不应触发 agent.run() 避免递归", async () => {
    const agent = mockAgent()
    const executeTaskSpy = vi.fn(mockExecuteTask)

    await runSteps(["测试步骤"], agent, executeTaskSpy)

    // executeTask 被调用（直接走 runLoop）
    expect(executeTaskSpy).toHaveBeenCalled()
    // agent.run() 不应被调用（避免递归）
    expect(agent.run).not.toHaveBeenCalled()
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

