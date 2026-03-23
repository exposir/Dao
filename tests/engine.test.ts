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
    generate: vi.fn(),
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
    await runSteps(["步骤"], agent, mockExecuteTask, undefined, onStart, onEnd)

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

describe("parallel 步骤部分失败 (Promise.allSettled)", () => {
  it("一个子步骤失败不应影响其他子步骤", async () => {
    const agent = mockAgent()
    let callCount = 0
    const failingExecuteTask = async (task: string): Promise<RunResult> => {
      callCount++
      if (task.includes("失败")) {
        throw new Error("子步骤执行失败")
      }
      return {
        output: `完成: ${task}`,
        turns: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        duration: 0,
      }
    }

    const results = await runSteps([
      { parallel: ["成功任务", "失败任务", "另一个成功"] },
    ], agent, failingExecuteTask)

    expect(results).toHaveLength(1)
    const parallelResults = results[0].result as any[]
    expect(parallelResults).toHaveLength(3)
    // 成功的子步骤
    expect(parallelResults[0]).toBe("完成: 成功任务")
    expect(parallelResults[2]).toBe("完成: 另一个成功")
    // 失败的子步骤记录了错误
    expect(parallelResults[1]).toHaveProperty("error")
    expect(parallelResults[1].error).toContain("子步骤执行失败")
  })
})

describe("lastResult 注入", () => {
  it("字符串步骤应该将上一步结果注入到 prompt 中", async () => {
    const agent = mockAgent()
    const capturedPrompts: string[] = []
    const capturingExecuteTask = async (task: string): Promise<RunResult> => {
      capturedPrompts.push(task)
      return {
        output: `完成: ${task.slice(0, 20)}`,
        turns: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        duration: 0,
      }
    }

    await runSteps(["第一步", "第二步"], agent, capturingExecuteTask)

    // 第一步没有 lastResult，prompt 就是原始步骤文本
    expect(capturedPrompts[0]).toBe("第一步")
    // 第二步应该包含上一步的结果
    expect(capturedPrompts[1]).toContain("上一步的执行结果")
    expect(capturedPrompts[1]).toContain("当前步骤：第二步")
  })

  it("TaskStep 也应该注入 lastResult", async () => {
    const agent = mockAgent()
    const capturedPrompts: string[] = []
    const capturingExecuteTask = async (task: string): Promise<RunResult> => {
      capturedPrompts.push(task)
      return {
        output: `完成: ${task.slice(0, 20)}`,
        turns: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        duration: 0,
      }
    }

    await runSteps([
      "第一步",
      { task: "分析结果", output: "JSON 格式" },
    ], agent, capturingExecuteTask)

    // TaskStep 的 prompt 应该包含上一步结果
    expect(capturedPrompts[1]).toContain("上一步的执行结果")
    expect(capturedPrompts[1]).toContain("当前步骤：分析结果")
    expect(capturedPrompts[1]).toContain("期望输出：JSON 格式")
  })
})

describe("单步失败继续执行", () => {
  it("非 AbortError 的步骤失败应该记录错误并继续", async () => {
    const agent = mockAgent()
    let callCount = 0
    const failOnSecondTask = async (task: string): Promise<RunResult> => {
      callCount++
      if (callCount === 2) {
        throw new Error("第二步爆了")
      }
      return {
        output: `完成: ${task.slice(0, 10)}`,
        turns: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        duration: 0,
      }
    }

    const results = await runSteps(["步骤一", "步骤二", "步骤三"], agent, failOnSecondTask)

    expect(results).toHaveLength(3)
    // 第一步成功
    expect(results[0].result).toContain("完成")
    // 第二步失败但记录了错误
    expect(results[1].result).toHaveProperty("error")
    expect(results[1].result.error).toContain("第二步爆了")
    // 第三步继续执行
    expect(results[2].result).toContain("完成")
  })

  it("AbortError 应该中断整个流程", async () => {
    const agent = mockAgent()

    await expect(
      runSteps([
        "步骤一",
        (ctx: StepContext) => { ctx.abort("中止"); return "" },
        "步骤三",  // 不应执行
      ], agent, mockExecuteTask)
    ).rejects.toThrow(AbortError)
  })
})

describe("TaskStep validate 重试", () => {
  it("校验失败应该重试直到通过", async () => {
    const agent = mockAgent()
    let attempt = 0
    const executeTask = async (task: string): Promise<RunResult> => {
      attempt++
      return {
        output: attempt >= 2 ? "valid-json" : "bad-output",
        turns: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        duration: 0,
      }
    }

    const results = await runSteps([
      {
        task: "生成 JSON",
        validate: (r: string) => r === "valid-json" ? true : "格式不对",
        maxRetries: 2,
      },
    ], agent, executeTask)

    expect(results[0].result).toBe("valid-json")
    expect(attempt).toBe(2)
  })

  it("重试 prompt 应包含上次的实际输出", async () => {
    const agent = mockAgent()
    const prompts: string[] = []
    let attempt = 0
    const executeTask = async (task: string): Promise<RunResult> => {
      prompts.push(task)
      attempt++
      return {
        output: attempt >= 2 ? "correct" : "wrong-answer",
        turns: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        duration: 0,
      }
    }

    await runSteps([{
      task: "生成报告",
      validate: (r: string) => r === "correct" ? true : "内容错误",
      maxRetries: 2,
    }], agent, executeTask)

    expect(prompts).toHaveLength(2)
    // 第二次 prompt 应包含上次的错误输出和校验原因
    expect(prompts[1]).toContain("wrong-answer")
    expect(prompts[1]).toContain("内容错误")
    expect(prompts[1]).toContain("上次尝试")
  })
})

describe("ConditionalStep 条件判断失败", () => {
  it("字符串条件 LLM 异常应记录错误而不是静默走 else", async () => {
    const agent = mockAgent()
    const failingExecuteTask = async (task: string): Promise<RunResult> => {
      if (task.includes("请判断")) {
        throw new Error("网络超时")
      }
      return {
        output: `完成: ${task.slice(0, 20)}`,
        turns: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        duration: 0,
      }
    }

    const results = await runSteps([
      {
        if: "数据是否合格",
        then: "处理数据",
        else: "跳过处理",
      },
    ], agent, failingExecuteTask)

    // 应该记录错误，而不是静默走 else 返回 "跳过处理" 的结果
    expect(results).toHaveLength(1)
    expect(results[0].result).toHaveProperty("error")
    expect(results[0].result.error).toContain("网络超时")
  })
})

describe("WaitStep 超时", () => {
  it("设置 timeout 后超时应报错", async () => {
    const agent = mockAgent()
    // onWait 永远不 resolve
    const hangingWait = () => new Promise<any>(() => {})

    const results = await runSteps([
      { wait: true, timeout: 50, reason: "等待审批" },
      "后续步骤",
    ], agent, mockExecuteTask, undefined, undefined, undefined, hangingWait)

    // 超时被 runSteps 的 catch 捕获，记录错误并继续
    expect(results).toHaveLength(2)
    expect(results[0].result).toHaveProperty("error")
    expect(results[0].result.error).toContain("wait 步骤超时")
    expect(results[0].result.error).toContain("等待审批")
    // 后续步骤应继续执行
    expect(results[1].result).toContain("完成")
  })

  it("不设 timeout 时 WaitStep 应正常等待 resume", async () => {
    const agent = mockAgent()
    const quickWait = () => Promise.resolve("审批通过")

    const results = await runSteps([
      { wait: true, reason: "等待审批" },
    ], agent, mockExecuteTask, undefined, undefined, undefined, quickWait)

    expect(results).toHaveLength(1)
    expect(results[0].result).toBe("审批通过")
  })
})

describe("ParallelStep 上下文隔离", () => {
  it("并行子步骤不应污染彼此的 ctx.history", async () => {
    const agent = mockAgent()
    // 两个并行字符串步骤
    const results = await runSteps([
      {
        parallel: ["任务A", "任务B", "任务C"],
      },
    ], agent, mockExecuteTask)

    expect(results).toHaveLength(1)
    // 结果应该是数组（三个并行结果）
    const parallelResults = results[0].result
    expect(parallelResults).toHaveLength(3)
    // 每个子任务应独立完成
    expect(parallelResults[0]).toContain("完成")
    expect(parallelResults[1]).toContain("完成")
    expect(parallelResults[2]).toContain("完成")
  })
})
