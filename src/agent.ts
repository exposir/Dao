/**
 * 道（Dao）— Agent 入口
 *
 * agent() 是框架的核心函数，创建一个 AgentInstance。
 */

import type { ModelMessage } from "ai"
import type { AgentOptions, AgentInstance, RunResult, RunEvent } from "./types.js"
import { runLoop, runLoopStream } from "./loop.js"
import { runSteps } from "./engine.js"
import { PluginManager } from "./plugin.js"

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

  // 插件管理器
  const pm = new PluginManager(options.plugins)
  let initialized = false

  async function ensureInit() {
    if (!initialized && pm.hasPlugins) {
      await pm.setup(instance)
      initialized = true
    }
  }

  const instance: AgentInstance = {
    async chat(message: string): Promise<string> {
      await ensureInit()
      await pm.emit("beforeInput", instance, { message })

      const result = await runLoop(options, message, messageHistory, instance, pm)

      // 如果开启了记忆，保存对话历史
      if (options.memory) {
        messageHistory.push(
          { role: "user", content: message },
          { role: "assistant", content: result.output },
        )
      }

      await pm.emit("onComplete", instance, { result })
      return result.output
    },

    async run(task: string): Promise<RunResult> {
      await ensureInit()

      // 如果有 steps，使用 Steps 引擎
      if (options.steps?.length) {
        const startTime = Date.now()
        const stepResults = await runSteps(options.steps, instance)

        const lastResult = stepResults[stepResults.length - 1]
        const result: RunResult = {
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
        await pm.emit("onComplete", instance, { result })
        return result
      }

      // 无 steps，直接运行 Agent Loop
      const result = await runLoop(options, task, [], instance, pm)
      await pm.emit("onComplete", instance, { result })
      return result
    },

    async *chatStream(message: string): AsyncIterable<string> {
      await ensureInit()
      await pm.emit("beforeInput", instance, { message })

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
