/**
 * 道（Dao）— Agent 入口
 *
 * agent() 是框架的核心函数，创建一个 AgentInstance。
 */

import type { ModelMessage } from "ai"
import type { AgentOptions, AgentInstance, RunResult, RunEvent } from "./core/types.js"
import { runLoop, runLoopStream } from "./core/loop.js"
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

  /**
   * 执行单个字符串任务（直接走 runLoop，跳过 steps 引擎避免递归）
   * 收集每步的 usage 用于汇总
   */
  const stepUsages: { promptTokens: number; completionTokens: number; totalTokens: number }[] = []

  async function executeTask(task: string): Promise<RunResult> {
    const result = await runLoop(options, task, [], instance, pm)
    stepUsages.push(result.usage)
    return result
  }

  const instance: AgentInstance = {
    async chat(message: string): Promise<string> {
      await ensureInit()
      await pm.emit("beforeInput", instance, { message })

      try {
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
      } catch (err: any) {
        await pm.emit("onError", instance, { error: err })
        throw err
      }
    },

    async run(task: string): Promise<RunResult> {
      await ensureInit()

      try {
        // 如果有 steps，使用 Steps 引擎
        if (options.steps?.length) {
          const startTime = Date.now()
          const stepResults = await runSteps(
            options.steps,
            instance,
            executeTask,
            // onStepStart
            undefined,
            // onStepEnd → 触发 afterStep hook
            async (step, _index, result) => {
              await pm.emit("afterStep", instance, { step, result })
            },
          )

          const lastResult = stepResults[stepResults.length - 1]

          // 汇总所有步骤的 token 用量
          const totalUsage = {
            promptTokens: stepUsages.reduce((s, u) => s + u.promptTokens, 0),
            completionTokens: stepUsages.reduce((s, u) => s + u.completionTokens, 0),
            totalTokens: stepUsages.reduce((s, u) => s + u.totalTokens, 0),
          }

          const result: RunResult = {
            output: typeof lastResult?.result === "string"
              ? lastResult.result
              : JSON.stringify(lastResult?.result ?? ""),
            turns: stepResults.map((s, i) => ({
              turn: `step-${i + 1}`,
              result: s.result,
            })),
            usage: totalUsage,
            duration: Date.now() - startTime,
          }
          await pm.emit("onComplete", instance, { result })
          return result
        }

        // 无 steps，直接运行 Agent Loop
        const result = await runLoop(options, task, [], instance, pm)
        await pm.emit("onComplete", instance, { result })
        return result
      } catch (err: any) {
        await pm.emit("onError", instance, { error: err })
        throw err
      }
    },

    async *chatStream(message: string): AsyncIterable<string> {
      await ensureInit()
      await pm.emit("beforeInput", instance, { message })

      try {
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
      } catch (err: any) {
        await pm.emit("onError", instance, { error: err })
        throw err
      }
    },

    async *runStream(task: string): AsyncIterable<RunEvent> {
      await ensureInit()

      // 如果有 steps，走 steps 引擎
      if (options.steps?.length) {
        const stepResults = await runSteps(
          options.steps,
          instance,
          executeTask,
          // onStepStart → 发 step_start 事件
          (step, index) => {
            // 注意：这里不能 yield（非 generator 回调），事件通过 afterStep hook 触发
          },
          // onStepEnd → 触发 afterStep hook
          async (step, _index, result) => {
            await pm.emit("afterStep", instance, { step, result })
          },
        )

        const lastResult = stepResults[stepResults.length - 1]
        yield { type: "text", data: lastResult?.result ?? "" }
        yield { type: "done", data: null }
        return
      }

      // 无 steps，直接走 runLoopStream
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

