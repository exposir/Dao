/**
 * 道（Dao）— Agent 入口
 *
 * agent() 是框架的核心函数，创建一个 AgentInstance。
 */

import type { ModelMessage } from "ai"
import type { AgentOptions, AgentInstance, RunResult, RunEvent } from "./types.js"
import { runLoop, runLoopStream } from "./loop.js"

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
      const result = await runLoop(options, message, messageHistory)

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
      // run 模式不使用历史消息，每次独立执行
      return await runLoop(options, task, [])
    },

    async *chatStream(message: string): AsyncIterable<string> {
      for await (const event of runLoopStream(options, message, messageHistory)) {
        if (event.type === "text") {
          yield event.data
        }
      }

      // 流式模式下也保存记忆（收集完整输出后）
      // 注意：简化处理，流式模式下暂不保存记忆
    },

    async *runStream(task: string): AsyncIterable<RunEvent> {
      yield* runLoopStream(options, task, [])
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
