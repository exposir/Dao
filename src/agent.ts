/**
 * 道（Dao）— Agent 入口
 *
 * agent() 是框架的核心函数，创建一个 AgentInstance。
 */

import type { ModelMessage } from "ai"
import type { AgentOptions, AgentInstance, RunResult, RunEvent, ToolInstance, GenerateOptions, GenerateResult } from "./core/types.js"
import { runLoop, runLoopStream, runGenerate } from "./core/loop.js"
import { runSteps } from "./engine.js"
import { PluginManager } from "./plugin.js"
import { tool } from "./tool.js"
import { getGlobalConfig } from "./core/config.js"

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
  // delegates：自动注入 delegate 工具
  if (options.delegates && Object.keys(options.delegates).length > 0) {
    const delegates = options.delegates
    const memberDescriptions = Object.entries(delegates)
      .map(([name, member]) => {
        const config = member.getConfig()
        return `- **${name}**: ${config.role ?? "通用 Agent"}`
      })
      .join("\n")

    const delegateTool = tool({
      name: "delegate",
      description:
        `将任务委派给其他 Agent 执行。可用 Agent：\n${memberDescriptions}\n` +
        `使用 member 参数指定名称，task 参数描述任务。`,
      params: {
        member: "Agent 名称",
        task: "要委派的任务描述",
      },
      run: async ({ member: memberName, task }) => {
        const memberAgent = delegates[memberName]
        if (!memberAgent) {
          return `错误：Agent "${memberName}" 不存在。可用：${Object.keys(delegates).join(", ")}`
        }
        try {
          const result = await memberAgent.run(task)
          return result.output
        } catch (err: any) {
          return `Agent "${memberName}" 执行失败：${err.message}`
        }
      },
    })

    options = {
      ...options,
      tools: [...(options.tools ?? []), delegateTool],
    }
  }

  // 对话历史（memory 用）
  let messageHistory: ModelMessage[] = []

  // 插件管理器：合并全局插件 + 实例插件
  const globalCfg = getGlobalConfig()
  const allPlugins = [
    ...(globalCfg.globalPlugins ?? []),
    ...(options.plugins ?? []),
  ]
  const pm = new PluginManager(allPlugins)
  let initialized = false

  async function ensureInit() {
    if (!initialized && pm.hasPlugins) {
      await pm.setup(instance)
      initialized = true
    }
  }

  // wait / resume 机制
  let waitResolve: ((data?: any) => void) | null = null

  function onWait(): Promise<any> {
    return new Promise((resolve) => {
      waitResolve = resolve
    })
  }

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
          stepUsages.length = 0  // 清空上次 run 的累积
          const startTime = Date.now()
          const stepResults = await runSteps(
            options.steps,
            instance,
            executeTask,
            undefined,
            async (step, _index, result) => {
              await pm.emit("afterStep", instance, { step, result })
            },
            onWait,
          )

          const lastResult = stepResults[stepResults.length - 1]

          // 检查是否所有步骤都失败
          const allFailed = stepResults.every(s => s.result?.error)
          let output: string
          if (allFailed) {
            output = stepResults
              .map((s, i) => `步骤 ${i + 1} 失败：${s.result?.error}`)
              .join("\n")
          } else {
            output = typeof lastResult?.result === "string"
              ? lastResult.result
              : JSON.stringify(lastResult?.result ?? "")
          }

          // 汇总所有步骤的 token 用量
          const totalUsage = {
            promptTokens: stepUsages.reduce((s, u) => s + u.promptTokens, 0),
            completionTokens: stepUsages.reduce((s, u) => s + u.completionTokens, 0),
            totalTokens: stepUsages.reduce((s, u) => s + u.totalTokens, 0),
          }

          const result: RunResult = {
            output,
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
      const startTime = Date.now()

      try {
        let fullText = ""
        let streamUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
        for await (const event of runLoopStream(options, message, messageHistory, instance, pm)) {
          if (event.type === "text") {
            fullText += event.data
            yield event.data
          } else if (event.type === "done" && event.data?.usage) {
            streamUsage = event.data.usage
          }
        }

        // 流式结束后保存记忆，与 chat() 行为一致
        if (options.memory) {
          messageHistory.push(
            { role: "user", content: message },
            { role: "assistant", content: fullText },
          )
        }

        await pm.emit("onComplete", instance, { result: { output: fullText, duration: Date.now() - startTime, turns: [], usage: streamUsage } })
      } catch (err: any) {
        await pm.emit("onError", instance, { error: err })
        throw err
      }
    },

    async *runStream(task: string): AsyncIterable<RunEvent> {
      await ensureInit()
      const startTime = Date.now()

      try {
        // 如果有 steps，走 steps 引擎
        if (options.steps?.length) {
          stepUsages.length = 0
          const events: RunEvent[] = []

          const stepResults = await runSteps(
            options.steps,
            instance,
            executeTask,
            // onStepStart
            (step, index) => {
              const stepName = typeof step === "string" ? step : (step as any).task ?? JSON.stringify(step)
              events.push({ type: "step_start", data: { step: stepName, index } })
            },
            // onStepEnd
            async (step, index, result) => {
              const stepName = typeof step === "string" ? step : (step as any).task ?? JSON.stringify(step)
              events.push({ type: "step_end", data: { step: stepName, index, result } })
              await pm.emit("afterStep", instance, { step, result })
            },
          )

          // 发所有事件
          for (const event of events) {
            yield event
          }

          const lastResult = stepResults[stepResults.length - 1]
          // 检查是否所有步骤都失败（与 run() 逻辑一致）
          const allFailed = stepResults.every(s => s.result?.error)
          let outputText: string
          if (allFailed) {
            outputText = stepResults
              .map((s, i) => `步骤 ${i + 1} 失败：${s.result?.error}`)
              .join("\n")
          } else {
            outputText = typeof lastResult?.result === "string"
              ? lastResult.result
              : JSON.stringify(lastResult?.result ?? "")
          }
          yield { type: "text", data: outputText }
          yield { type: "done", data: null }

          const totalUsage = {
            promptTokens: stepUsages.reduce((s, u) => s + u.promptTokens, 0),
            completionTokens: stepUsages.reduce((s, u) => s + u.completionTokens, 0),
            totalTokens: stepUsages.reduce((s, u) => s + u.totalTokens, 0),
          }
          await pm.emit("onComplete", instance, { result: { output: outputText, duration: Date.now() - startTime, turns: stepResults.map((s, i) => ({ turn: `step-${i + 1}`, result: s.result })), usage: totalUsage } })
          return
        }

        // 无 steps，直接走 runLoopStream
        let fullText = ""
        let streamUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
        for await (const event of runLoopStream(options, task, [], instance, pm)) {
          if (event.type === "text") fullText += event.data
          else if (event.type === "done" && event.data?.usage) streamUsage = event.data.usage
          yield event
        }
        await pm.emit("onComplete", instance, { result: { output: fullText, duration: Date.now() - startTime, turns: [], usage: streamUsage } })
      } catch (err: any) {
        await pm.emit("onError", instance, { error: err })
        throw err
      }
    },

    async generate<T = any>(task: string, generateOptions: GenerateOptions<T>): Promise<GenerateResult<T>> {
      await ensureInit()

      try {
        const result = await runGenerate<T>(options, task, generateOptions, instance, pm)
        await pm.emit("onComplete", instance, { result: { output: JSON.stringify(result.object), turns: [], usage: result.usage, duration: result.duration } })
        return result
      } catch (err: any) {
        await pm.emit("onError", instance, { error: err })
        throw err
      }
    },

    resume(data?: any): void {
      if (waitResolve) {
        waitResolve(data)
        waitResolve = null
      }
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
