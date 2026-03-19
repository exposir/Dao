/**
 * 道（Dao）— Agent 入口
 *
 * agent() 是框架的核心函数，创建一个 AgentInstance。
 */

import type { ModelMessage } from "ai"
import type { AgentOptions, AgentInstance, RunResult, RunEvent } from "./types.js"
import { runLoop, runLoopStream } from "./loop.js"
import { runSteps } from "./engine.js"

/**
 * 创建一个 Agent 实例
 *
 * @example
 * ```typescript
 * // 最简用法
 * const bot = agent({ model: "deepseek/deepseek-chat" })
 * await bot.chat("你好")
 *
 * // 完整用法
 * const coder = agent({
 *   role: "开发者",
 *   model: "deepseek/deepseek-chat",
 *   tools: [readFile, writeFile],
 *   rules: { reject: ["删除文件"] },
 *   memory: true,
 * })
 * await coder.run("把 README 翻译成英文")
 * ```
 */
export function agent(options: AgentOptions): AgentInstance {
  // 对话历史（memory 用）
  let messageHistory: ModelMessage[] = []

  const instance: AgentInstance = {
    async chat(message: string): Promise<string> {
      const result = await runLoop(options, message, messageHistory, instance)

      // 如果开启了记忆，保存对话历史
      if (options.memory) {
        messageHistory.push(
          { role: "user", content: message },
          { role: "assistant", content: result.output },
        )
      }

      return result.output
    },

    async run(task: string): Promise<RunResult> {
      // 如果有 steps，使用 Steps 引擎
      if (options.steps?.length) {
        const startTime = Date.now()
        const stepResults = await runSteps(options.steps, instance)

        // 汇总所有步骤结果
        const lastResult = stepResults[stepResults.length - 1]
        return {
          output: typeof lastResult?.result === "string"
            ? lastResult.result
            : JSON.stringify(lastResult?.result ?? ""),
          turns: stepResults.map((s, i) => ({
            turn: `step-${i + 1}`,
            result: s.result,
          })),
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          duration: Date.now() - startTime,
        }
      }

      // 无 steps，直接运行 Agent Loop
      return await runLoop(options, task, [], instance)
    },

    async *chatStream(message: string): AsyncIterable<string> {
      let fullText = ""
      for await (const event of runLoopStream(options, message, messageHistory, instance)) {
        if (event.type === "text") {
          fullText += event.data
          yield event.data
        }
      }

      // 流式结束后保存记忆，与 chat() 行为一致
      if (options.memory) {
        messageHistory.push(
          { role: "user", content: message },
          { role: "assistant", content: fullText },
        )
      }
    },

    async *runStream(task: string): AsyncIterable<RunEvent> {
      yield* runLoopStream(options, task, [], instance)
    },

    clearMemory(): void {
      messageHistory = []
    },

    getConfig(): AgentOptions {
      return { ...options }
    },
  }

  return instance
}
