/**
 * 道（Dao）— 测试辅助
 *
 * mockModel() 创建模拟模型，方便用户给 agent 写单测。
 * 通过 agent({ modelProvider: mockModel([...]) }) 注入。
 */

import type { LanguageModel } from "ai"

export interface MockModelOptions {
  /** 响应用完后是否循环，默认 false（抛错） */
  loop?: boolean
}

/**
 * 创建模拟模型
 *
 * @example
 * ```typescript
 * import { agent, mockModel } from "dao-ai"
 *
 * const bot = agent({
 *   modelProvider: mockModel(["你好", "再见"]),
 * })
 *
 * const r1 = await bot.chat("第一句")  // "你好"
 * const r2 = await bot.chat("第二句")  // "再见"
 * ```
 */
export function mockModel(responses: string[], options?: MockModelOptions): LanguageModel {
  const loop = options?.loop ?? false
  let index = 0

  function nextResponse(): string {
    if (index >= responses.length) {
      if (loop) {
        index = 0
      } else {
        throw new Error(`mockModel: 预设响应已用完（共 ${responses.length} 条）`)
      }
    }
    return responses[index++]
  }

  const model: any = {
    specificationVersion: "v3",
    provider: "mock",
    modelId: "mock-model",
    defaultObjectGenerationMode: "json",
    supportedUrls: {},

    async doGenerate(params: any) {
      const text = nextResponse()
      return {
        // AI SDK v3 要求 content 数组格式
        content: [
          { type: "text", text },
        ],
        finishReason: "stop",
        usage: {
          inputTokens: { total: text.length },
          outputTokens: { total: text.length },
        },
        warnings: [],
        response: {
          id: `mock-${Date.now()}`,
          timestamp: new Date(),
          modelId: "mock-model",
          headers: {},
        },
        rawCall: {
          rawPrompt: null,
          rawSettings: {},
        },
        sources: [],
        request: { body: undefined },
      }
    },

    async doStream(params: any) {
      const text = nextResponse()

      const stream = new ReadableStream({
        start(controller: any) {
          controller.enqueue({
            type: "text-delta",
            textDelta: text,
          })
          controller.enqueue({
            type: "source",
            source: undefined,
          })
          controller.enqueue({
            type: "finish",
            finishReason: "stop",
            usage: {
              inputTokens: { total: text.length },
              outputTokens: { total: text.length },
            },
          })
          controller.close()
        },
      })

      return {
        stream,
        rawCall: {
          rawPrompt: null,
          rawSettings: {},
        },
        rawResponse: undefined,
        warnings: [],
        response: {
          id: `mock-stream-${Date.now()}`,
          timestamp: new Date(),
          modelId: "mock-model",
          headers: {},
        },
        request: { body: undefined },
      }
    },
  }

  return model as LanguageModel
}
