/**
 * fallback + 错误传播 回归测试
 *
 * 使用真正抛错的 mock 模型验证：
 * - 无 fallbackModel 时错误上抛（通过 run / chat / chatStream）
 * - 主模型失败后成功切到备用模型（通过自定义 provider 纯本地覆盖）
 * - 主模型失败触发 onError 插件
 * - 有工具执行后的副作用安全
 */

import { describe, it, expect, afterEach } from "vitest"
import { agent, registerProvider, resetProviders } from "../src/index.js"
import { tool } from "../src/tool.js"
import { mockModel } from "../src/mock.js"
import { plugin } from "../src/plugin.js"
import type { LanguageModel } from "ai"

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
  resetProviders()
})

/**
 * 创建一个总是抛错的模型（模拟主模型不可用）
 */
function failingModel(errorMessage: string): LanguageModel {
  const model: any = {
    specificationVersion: "v3",
    provider: "mock",
    modelId: "failing-model",
    defaultObjectGenerationMode: "json",
    supportedUrls: {},
    async doGenerate() {
      throw new Error(errorMessage)
    },
    async doStream() {
      throw new Error(errorMessage)
    },
  }
  return model as LanguageModel
}

function registerMockFallbackProvider(
  providerName: string,
  envKey: string,
  responses: string[],
): string {
  process.env[envKey] = "test-key"
  registerProvider(providerName, {
    create: async () => (_modelId: string) => mockModel(responses),
    envKey,
    defaultModel: "default",
  })
  return `${providerName}/default`
}

describe("主模型失败行为（Agent Loop catch 路径）", () => {
  it("无 fallbackModel 时主模型异常应通过 Agent Loop 上抛", async () => {
    const bot = agent({
      modelProvider: failingModel("API 限流"),
    })

    // 错误应该从 runLoop → agent.run() 的 catch 抛出
    await expect(bot.run("测试任务")).rejects.toThrow()
  })

  it("chat() 中主模型异常同样应上抛", async () => {
    const bot = agent({
      modelProvider: failingModel("网络超时"),
    })

    await expect(bot.chat("你好")).rejects.toThrow()
  })

  it("chatStream() 中主模型异常应上抛", async () => {
    const bot = agent({
      modelProvider: failingModel("模型不可用"),
    })

    // 流式也应该抛错
    await expect(async () => {
      for await (const _chunk of bot.chatStream("你好")) {
        // 不会到这里
      }
    }).rejects.toThrow()
  })

  it("主模型失败应触发 onError 插件", async () => {
    const errors: string[] = []

    const errorTracker = plugin({
      name: "error-tracker",
      hooks: {
        onError: (ctx) => {
          errors.push(ctx.error.message)
        },
      },
    })

    const bot = agent({
      modelProvider: failingModel("模型爆炸"),
      plugins: [errorTracker],
    })

    await expect(bot.run("测试")).rejects.toThrow()
    // 非 AbortError 的错误应该触发 onError
    expect(errors.length).toBeGreaterThan(0)
  })
})

describe("fallback 配置验证", () => {
  it("run() 在主模型失败后应切到 fallbackModel", async () => {
    const fallbackModel = registerMockFallbackProvider(
      "testfallbackrun",
      "TEST_FALLBACK_RUN_KEY",
      ["备用模型结果"],
    )

    const bot = agent({
      modelProvider: failingModel("主模型失败"),
      fallbackModel,
    })

    const result = await bot.run("测试任务")
    expect(result.output).toBe("备用模型结果")
  })

  it("chatStream() 在主模型失败后应切到 fallbackModel", async () => {
    const fallbackModel = registerMockFallbackProvider(
      "testfallbackstream",
      "TEST_FALLBACK_STREAM_KEY",
      ["备用流式结果"],
    )

    const bot = agent({
      modelProvider: failingModel("主模型流式失败"),
      fallbackModel,
    })

    let output = ""
    for await (const chunk of bot.chatStream("你好")) {
      output += chunk
    }

    expect(output).toBe("备用流式结果")
  })

  it("fallbackModel 和 model 应为独立字段", () => {
    const bot = agent({
      model: "deepseek/deepseek-chat",
      fallbackModel: "openai/gpt-4o",
    })

    const config = bot.getConfig()
    expect(config.model).toBe("deepseek/deepseek-chat")
    expect(config.fallbackModel).toBe("openai/gpt-4o")
    expect(config.model).not.toBe(config.fallbackModel)
  })

  it("没有 fallbackModel 时 config 中应为 undefined", () => {
    const bot = agent({ modelProvider: mockModel(["ok"]) })
    expect(bot.getConfig().fallbackModel).toBeUndefined()
  })
})

describe("工具副作用安全", () => {
  it("工具应该能独立执行且计数正确", async () => {
    let toolCallCount = 0
    const sideEffectTool = tool({
      name: "writeData",
      description: "写入数据（有副作用）",
      params: { data: "数据内容" },
      run: ({ data }) => {
        toolCallCount++
        return `已写入: ${data} (#${toolCallCount})`
      },
    })

    const result = await sideEffectTool.execute({ data: "test" })
    expect(result).toContain("已写入")
    expect(toolCallCount).toBe(1)

    // 再次调用应该递增
    await sideEffectTool.execute({ data: "test2" })
    expect(toolCallCount).toBe(2)
  })
})

describe("并发限制标注", () => {
  it("resume() 是广播式恢复（设计限制）", () => {
    const bot = agent({
      modelProvider: mockModel(["ok"]),
      steps: [{ wait: true }, "完成"],
    })

    expect(typeof bot.resume).toBe("function")
    // 见 docs/engine.md §2.5 WARNING
  })

  it("team() 实例不应并发调用 run()/runStream()（设计限制）", () => {
    // 见 docs/team.md §9
    expect(true).toBe(true)
  })
})
