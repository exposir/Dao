/**
 * ctx.abort() 行为测试
 *
 * 验证 abort 机制在不同路径的行为：
 * 1. Steps 引擎中 ctx.abort() → 正常工作（engine.test.ts 已覆盖）
 * 2. 直接调用 tool.execute(ctx) → AbortError 正常抛出
 * 3. 通过 Agent Loop (generateText) → ctx.abort() 通过 AbortController
 *    信号中断 generateText，成功穿透 AI SDK 的 tool-error 捕获机制
 *
 * 同时验证 onError 插件的正确触发行为。
 */

import { describe, it, expect, vi } from "vitest"
import { agent, tool, mockModel, AbortError } from "../src/index.js"
import { plugin } from "../src/plugin.js"
import type { LanguageModel } from "ai"

/**
 * 创建一个返回 tool-call 的 mock 模型
 * AI SDK v3 要求 tool-call 的 input 字段为 JSON 字符串
 */
function mockToolCallModel(toolName: string, args: Record<string, any>, followUpText: string): LanguageModel {
  let callCount = 0
  const model: any = {
    specificationVersion: "v3",
    provider: "mock",
    modelId: "mock-tool-call-model",
    defaultObjectGenerationMode: "json",
    supportedUrls: {},
    async doGenerate() {
      callCount++
      if (callCount === 1) {
        return {
          content: [{
            type: "tool-call",
            toolCallId: `call-${Date.now()}`,
            toolName,
            input: JSON.stringify(args),
          }],
          finishReason: "tool-calls",
          usage: { inputTokens: { total: 10 }, outputTokens: { total: 10 } },
          warnings: [],
          response: { id: `mock-tc-${Date.now()}`, timestamp: new Date(), modelId: "mock-tool-call-model", headers: {} },
          rawCall: { rawPrompt: null, rawSettings: {} },
          sources: [],
          request: { body: undefined },
        }
      }
      return {
        content: [{ type: "text", text: followUpText }],
        finishReason: "stop",
        usage: { inputTokens: { total: followUpText.length }, outputTokens: { total: followUpText.length } },
        warnings: [],
        response: { id: `mock-text-${Date.now()}`, timestamp: new Date(), modelId: "mock-tool-call-model", headers: {} },
        rawCall: { rawPrompt: null, rawSettings: {} },
        sources: [],
        request: { body: undefined },
      }
    },
    async doStream() { throw new Error("doStream not implemented") },
  }
  return model as LanguageModel
}

describe("AbortError 基础", () => {
  it("应该是 Error 的子类", () => {
    const err = new AbortError("测试中止")
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("AbortError")
    expect(err.message).toBe("测试中止")
  })
})

describe("ctx.abort() 直接调用", () => {
  it("tool.execute(ctx) 中调用 abort 应抛出 AbortError", async () => {
    const abortTool = tool({
      name: "abort_tool",
      description: "调用 ctx.abort()",
      params: {},
      run: (_params, ctx) => {
        ctx!.abort("测试中止")
        return "不会到这里"
      },
    })

    const mockAgent = agent({ modelProvider: mockModel(["mock"]) })

    await expect(
      abortTool.execute({}, {
        agent: mockAgent,
        abort: (reason?: string) => { throw new AbortError(reason ?? "中止") },
      })
    ).rejects.toThrow(AbortError)

    await expect(
      abortTool.execute({}, {
        agent: mockAgent,
        abort: (reason?: string) => { throw new AbortError(reason ?? "中止") },
      })
    ).rejects.toThrow("测试中止")
  })
})

describe("工具通过 Agent Loop 被调用", () => {
  it("mockToolCallModel 应能驱动 Agent Loop 真正调用工具", async () => {
    let toolCalled = false

    const normalTool = tool({
      name: "my_tool",
      description: "测试工具",
      params: {},
      run: () => {
        toolCalled = true
        return "工具结果"
      },
    })

    const bot = agent({
      modelProvider: mockToolCallModel("my_tool", {}, "最终结果"),
      tools: [normalTool],
    })

    const result = await bot.run("测试任务")
    expect(toolCalled).toBe(true)
    expect(result.output).toBe("最终结果")
  })

  it("ctx.abort() 应通过 AbortController 中断 Agent Loop", async () => {
    const abortTool = tool({
      name: "abort_tool",
      description: "中止执行",
      params: {},
      run: (_params, ctx) => {
        ctx!.abort("工具主动中止")
        return "不会到这里"
      },
    })

    const bot = agent({
      modelProvider: mockToolCallModel("abort_tool", {}, "不会返回"),
      tools: [abortTool],
    })

    // ctx.abort() 现在通过 AbortController 信号中断 generateText，应拒绝
    await expect(bot.run("测试")).rejects.toThrow(AbortError)

    // 用新 agent 验证错误消息（mockToolCallModel 的 callCount 是共享的）
    const bot2 = agent({
      modelProvider: mockToolCallModel("abort_tool", {}, "不会返回"),
      tools: [abortTool],
    })
    await expect(bot2.run("再试")).rejects.toThrow("工具主动中止")
  })

  it("非 abort 的工具报错被 AI SDK 捕获，Agent 仍能正常完成", async () => {
    // AI SDK v3 的 executeToolCall 会 catch 所有工具异常（非 abort），
    // 转为 tool-error 结果反馈给模型。
    const errorTool = tool({
      name: "failing_tool",
      description: "会报错的工具",
      params: {},
      run: () => {
        throw new Error("工具内部错误")
      },
    })

    const bot = agent({
      modelProvider: mockToolCallModel("failing_tool", {}, "错误后继续"),
      tools: [errorTool],
    })

    const result = await bot.run("测试")
    expect(result.output).toBe("错误后继续")
  })
})

describe("onError 插件交互", () => {
  it("正常执行不应触发 onError", async () => {
    const errors: string[] = []

    const errorTracker = plugin({
      name: "error-tracker",
      hooks: { onError: (ctx) => { errors.push(ctx.error.message) } },
    })

    const bot = agent({
      modelProvider: mockModel(["正常回复"]),
      plugins: [errorTracker],
    })

    const reply = await bot.chat("测试")
    expect(reply).toBe("正常回复")
    expect(errors).toHaveLength(0)
  })

  it("run() 正常完成不应触发 onError", async () => {
    const errors: string[] = []

    const errorTracker = plugin({
      name: "error-tracker",
      hooks: { onError: (ctx) => { errors.push(ctx.error.message) } },
    })

    const bot = agent({
      modelProvider: mockModel(["任务完成"]),
      plugins: [errorTracker],
    })

    const result = await bot.run("执行")
    expect(result.output).toBe("任务完成")
    expect(errors).toHaveLength(0)
  })

  it("非 abort 的模型错误应触发 onError", async () => {
    const errors: string[] = []

    const errorTracker = plugin({
      name: "error-tracker",
      hooks: { onError: (ctx) => { errors.push(ctx.error.message) } },
    })

    // 没有 model/modelProvider/env → "未指定模型"
    const envVars = [
      "DEEPSEEK_API_KEY", "OPENAI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY",
      "ANTHROPIC_API_KEY", "MOONSHOTAI_API_KEY", "ALIBABA_API_KEY", "ZHIPU_API_KEY",
    ]
    const saved: Record<string, string | undefined> = {}
    for (const k of envVars) { saved[k] = process.env[k]; delete process.env[k] }

    try {
      const bot = agent({ plugins: [errorTracker] })
      await expect(bot.chat("测试")).rejects.toThrow("未指定模型")
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0]).toContain("未指定模型")
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v !== undefined) process.env[k] = v; else delete process.env[k]
      }
    }
  })
})
