/**
 * 道（Dao）— Agent Loop 核心循环
 *
 * 实现 Agent 的模型调用循环：
 * 1. 组装 system prompt
 * 2. 调用模型
 * 3. 如果模型要求调用工具 → 执行工具 → 继续循环
 * 4. 如果模型返回纯文本 → 完成
 * 5. maxTurns 兜底（通过 stopWhen + stepCountIs 实现）
 */

import { generateText, generateObject, streamText, stepCountIs, jsonSchema } from "ai"
import type { ModelMessage, ToolSet } from "ai"
import type {
  AgentOptions,
  AgentInstance,
  ToolInstance,
  ToolContext,
  RunResult,
  RunEvent,
  TokenUsage,
  GenerateOptions,
  GenerateResult,
} from "./types.js"
import { resolveModel, detectDefaultModel } from "./model.js"
import { getGlobalConfig } from "./config.js"
import { compileRules } from "../rules.js"
import { ModelError, ToolError, TimeoutError } from "./errors.js"
import type { PluginManager } from "../plugin.js"

/** 将 ToolInstance[] 转为 AI SDK 的 tools 格式 */
function toAITools(
  tools: ToolInstance[],
  agentInstance: AgentInstance,
  pm?: PluginManager,
  options?: AgentOptions,
  onToolCall?: (name: string, params: any, result: any) => void,
): ToolSet {
  const result: ToolSet = {}
  for (const t of tools) {
    result[t.name] = {
      description: t.description,
      inputSchema: jsonSchema<any>({
        type: "object",
        properties: t.schema.properties,
        required: t.schema.required,
        additionalProperties: false,
      }),
      execute: async (params: any) => {
        // 触发 beforeToolCall hook
        if (pm) {
          const { skipped } = await pm.emit("beforeToolCall", agentInstance, { tool: t.name, params })
          if (skipped) return "[工具调用被插件跳过]"
        }

        // confirm 机制
        if (t.confirm && options?.onConfirm) {
          const confirmed = await options.onConfirm(t.name, params)
          if (!confirmed) {
            const msg = `工具 "${t.name}" 被用户拒绝执行`
            onToolCall?.(t.name, params, msg)
            return msg
          }
        }

        try {
          const ctx: ToolContext = {
            agent: agentInstance,
            abort: () => { throw new Error("工具中止执行") },
          }
          const output = await t.execute(params, ctx)
          const toolResult = typeof output === "string" ? output : JSON.stringify(output)

          // 触发 afterToolCall hook
          if (pm) {
            await pm.emit("afterToolCall", agentInstance, { tool: t.name, result: toolResult })
          }

          onToolCall?.(t.name, params, toolResult)
          return toolResult
        } catch (err: any) {
          const toolErr = err instanceof ToolError
            ? err
            : new ToolError(`工具 "${t.name}" 执行失败：${err.message}`, t.name, err)

          if (pm) {
            await pm.emit("afterToolCall", agentInstance, { tool: t.name, result: toolErr.message })
          }

          onToolCall?.(t.name, params, toolErr.message)
          return toolErr.message
        }
      },
    } as any
  }
  return result
}

/** 组装 system prompt */
function buildSystemPrompt(options: AgentOptions): string {
  // 专家模式：systemPrompt 存在时直接用，忽略 role/goal/background
  if (options.systemPrompt) {
    // 仍然拼接 rules
    const rulesPrompt = compileRules(options.rules)
    return rulesPrompt
      ? `${options.systemPrompt}\n\n${rulesPrompt}`
      : options.systemPrompt
  }

  const parts: string[] = []

  if (options.role) {
    parts.push(`你的角色是：${options.role}`)
  }

  if (options.goal) {
    parts.push(`你的目标是：${options.goal}`)
  }

  if (options.background) {
    parts.push(`背景：${options.background}`)
  }

  // 使用 rules 系统编译规则
  const rulesPrompt = compileRules(options.rules)
  if (rulesPrompt) {
    parts.push(rulesPrompt)
  }

  return parts.join("\n\n")
}

/**
 * 执行 Agent Loop（非流式）
 */
export async function runLoop(
  options: AgentOptions,
  task: string,
  messageHistory: ModelMessage[],
  agentInstance: AgentInstance,
  pm?: PluginManager,
): Promise<RunResult> {
  const globalConfig = getGlobalConfig()
  const maxTurns = options.maxTurns ?? globalConfig.defaultMaxTurns ?? 50
  const modelString = options.model ?? globalConfig.defaultModel ?? detectDefaultModel()

  if (!options.modelProvider && !modelString) {
    throw new Error(
      "未指定模型。请通过 agent({ model: \"provider/model\" }) 或 " +
      "configure({ defaultModel: \"provider/model\" }) 指定，" +
      "或设置环境变量（如 DEEPSEEK_API_KEY）让框架自动检测。"
    )
  }

  const model = options.modelProvider ?? await resolveModel(modelString!)
  const systemPrompt = buildSystemPrompt(options)
  const tools = options.tools?.length ? toAITools(options.tools, agentInstance, pm, options) : undefined

  const messages: ModelMessage[] = [
    ...messageHistory,
    { role: "user", content: task },
  ]

  const startTime = Date.now()

  // 超时控制
  let controller: AbortController | undefined
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  if (options.timeout) {
    controller = new AbortController()
    timeoutId = setTimeout(() => controller!.abort(), options.timeout)
  }

  // 触发 beforeModelCall hook
  if (pm) {
    const { skipped } = await pm.emit("beforeModelCall", agentInstance, { prompt: systemPrompt })
    if (skipped) {
      if (timeoutId) clearTimeout(timeoutId)
      return { output: "", turns: [], usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, duration: 0 }
    }
  }

  try {
    const result = await generateText({
      model,
      system: systemPrompt || undefined,
      messages,
      tools,
      temperature: options.temperature,
      maxOutputTokens: options.maxTokens,
      maxRetries: options.retry?.maxRetries ?? 2,
      abortSignal: controller?.signal,
      stopWhen: stepCountIs(maxTurns),
      providerOptions: {
        openai: { strictJsonSchema: false },
      },
    })

    if (timeoutId) clearTimeout(timeoutId)

    // 触发 afterModelCall hook
    if (pm) {
      await pm.emit("afterModelCall", agentInstance, {
        response: {
          text: result.text,
          usage: {
            promptTokens: result.totalUsage?.inputTokens ?? 0,
            completionTokens: result.totalUsage?.outputTokens ?? 0,
            totalTokens: (result.totalUsage?.inputTokens ?? 0) + (result.totalUsage?.outputTokens ?? 0),
          },
        },
      })
    }

    // 提取 token 用量
    const usage: TokenUsage = {
      promptTokens: result.totalUsage?.inputTokens ?? 0,
      completionTokens: result.totalUsage?.outputTokens ?? 0,
      totalTokens: (result.totalUsage?.inputTokens ?? 0) + (result.totalUsage?.outputTokens ?? 0),
    }

    // 收集轮次记录
    const turnResults = result.steps?.map((step, i) => ({
      turn: `turn-${i + 1}`,
      result: step.text || null,
    })) ?? []

    return {
      output: result.text,
      turns: turnResults,
      usage,
      duration: Date.now() - startTime,
    }
  } catch (err: any) {
    if (timeoutId) clearTimeout(timeoutId)

    // 超时检测
    if (controller?.signal?.aborted || err?.name === "AbortError") {
      throw new TimeoutError(
        `模型调用超时（${options.timeout}ms）`,
        options.timeout!,
      )
    }

    // 包装为 ModelError
    if (options.fallbackModel) {
      // Fallback：用备用模型重试一次
      try {
        const fallbackModel = await resolveModel(options.fallbackModel)
        const fallbackResult = await generateText({
          model: fallbackModel,
          system: systemPrompt || undefined,
          messages,
          tools,
          temperature: options.temperature,
          maxOutputTokens: options.maxTokens,
          maxRetries: options.retry?.maxRetries ?? 2,
          stopWhen: stepCountIs(maxTurns),
          providerOptions: {
            openai: { strictJsonSchema: false },
          },
        })

        if (timeoutId) clearTimeout(timeoutId)
        if (pm) {
          const fallbackUsage = {
            promptTokens: fallbackResult.totalUsage?.inputTokens ?? 0,
            completionTokens: fallbackResult.totalUsage?.outputTokens ?? 0,
            totalTokens: (fallbackResult.totalUsage?.inputTokens ?? 0) + (fallbackResult.totalUsage?.outputTokens ?? 0),
          }
          await pm.emit("afterModelCall", agentInstance, {
            response: { text: fallbackResult.text, usage: fallbackUsage },
          })
        }

        const usage: TokenUsage = {
          promptTokens: fallbackResult.totalUsage?.inputTokens ?? 0,
          completionTokens: fallbackResult.totalUsage?.outputTokens ?? 0,
          totalTokens: (fallbackResult.totalUsage?.inputTokens ?? 0) + (fallbackResult.totalUsage?.outputTokens ?? 0),
        }

        const turnResults = fallbackResult.steps?.map((step, i) => ({
          turn: `fallback-turn-${i + 1}`,
          result: step.text || null,
        })) ?? []

        return {
          output: fallbackResult.text,
          turns: turnResults,
          usage,
          duration: Date.now() - startTime,
        }
      } catch {
        // fallback 也失败，抛原始错误
      }
    }

    throw new ModelError(
      `模型调用失败：${err.message}`,
      err,
    )
  }
}

/**
 * 执行 Agent Loop（流式）
 */
export async function* runLoopStream(
  options: AgentOptions,
  task: string,
  messageHistory: ModelMessage[],
  agentInstance: AgentInstance,
  pm?: PluginManager,
): AsyncIterable<RunEvent> {
  const globalConfig = getGlobalConfig()
  const maxTurns = options.maxTurns ?? globalConfig.defaultMaxTurns ?? 50
  const modelString = options.model ?? globalConfig.defaultModel ?? detectDefaultModel()

  if (!options.modelProvider && !modelString) {
    throw new Error("未指定模型。")
  }

  const model = options.modelProvider ?? await resolveModel(modelString!)
  const systemPrompt = buildSystemPrompt(options)

  // tool_call 事件收集器
  const toolCallEvents: RunEvent[] = []
  const onToolCall = (name: string, params: any, result: any) => {
    toolCallEvents.push({ type: "tool_call", data: { tool: name, params, result } })
  }
  const tools = options.tools?.length ? toAITools(options.tools, agentInstance, pm, options, onToolCall) : undefined

  const messages: ModelMessage[] = [
    ...messageHistory,
    { role: "user", content: task },
  ]

  // 超时控制
  let controller: AbortController | undefined
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  if (options.timeout) {
    controller = new AbortController()
    timeoutId = setTimeout(() => controller!.abort(), options.timeout)
  }

  // 触发 beforeModelCall hook
  if (pm) {
    const { skipped } = await pm.emit("beforeModelCall", agentInstance, { prompt: systemPrompt })
    if (skipped) {
      if (timeoutId) clearTimeout(timeoutId)
      yield { type: "done", data: null }
      return
    }
  }

  try {
    const result = streamText({
      model,
      system: systemPrompt || undefined,
      messages,
      tools,
      temperature: options.temperature,
      maxOutputTokens: options.maxTokens,
      maxRetries: options.retry?.maxRetries ?? 2,
      abortSignal: controller?.signal,
      stopWhen: stepCountIs(maxTurns),
    })

    let fullText = ""
    for await (const part of result.textStream) {
      // 先发累积的 tool_call 事件
      while (toolCallEvents.length > 0) {
        yield toolCallEvents.shift()!
      }
      fullText += part
      yield { type: "text", data: part }
    }

    // 发剩余的 tool_call 事件
    while (toolCallEvents.length > 0) {
      yield toolCallEvents.shift()!
    }

    if (timeoutId) clearTimeout(timeoutId)

    // 获取真实用量
    const totalUsage = await result.totalUsage
    const usage = {
      promptTokens: totalUsage?.inputTokens ?? 0,
      completionTokens: totalUsage?.outputTokens ?? 0,
      totalTokens: (totalUsage?.inputTokens ?? 0) + (totalUsage?.outputTokens ?? 0),
    }

    // 触发 afterModelCall hook（传真实输出和用量）
    if (pm) {
      await pm.emit("afterModelCall", agentInstance, {
        response: { text: fullText, usage },
      })
    }

    // done 事件带上 usage，让上层拿到真实用量
    yield { type: "done", data: { usage } }
  } catch (err: any) {
    if (timeoutId) clearTimeout(timeoutId)

    if (controller?.signal?.aborted || err?.name === "AbortError") {
      throw new TimeoutError(
        `流式调用超时（${options.timeout}ms）`,
        options.timeout!,
      )
    }

    throw new ModelError(
      `流式调用失败：${err.message}`,
      err,
    )
  }
}

/**
 * 结构化输出（基于 AI SDK generateObject）
 */
export async function runGenerate<T = any>(
  options: AgentOptions,
  task: string,
  generateOptions: GenerateOptions<T>,
  agentInstance: AgentInstance,
  pm?: PluginManager,
): Promise<GenerateResult<T>> {
  const globalConfig = getGlobalConfig()
  const modelString = options.model ?? globalConfig.defaultModel ?? detectDefaultModel()

  if (!options.modelProvider && !modelString) {
    throw new Error("未指定模型。")
  }

  const model = options.modelProvider ?? await resolveModel(modelString!)
  const systemPrompt = buildSystemPrompt(options)

  // 超时控制
  let controller: AbortController | undefined
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  if (options.timeout) {
    controller = new AbortController()
    timeoutId = setTimeout(() => controller!.abort(), options.timeout)
  }

  // 触发 beforeModelCall hook
  if (pm) {
    const { skipped } = await pm.emit("beforeModelCall", agentInstance, { prompt: systemPrompt })
    if (skipped) {
      if (timeoutId) clearTimeout(timeoutId)
      return { object: {} as T, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, duration: 0 }
    }
  }

  const startTime = Date.now()

  try {
    const generateOptionsAny: any = {
      model,
      system: systemPrompt || undefined,
      prompt: task,
      schema: generateOptions.schema,
      schemaName: generateOptions.schemaName ?? "result",
      schemaDescription: generateOptions.schemaDescription,
      mode: "json", // DeepSeek 等模型可能不支持默认的 auto/json_schema，显式指定 json 模式
      temperature: options.temperature,
      maxOutputTokens: options.maxTokens,
      maxRetries: options.retry?.maxRetries ?? 2,
      abortSignal: controller?.signal,
    };

    const result = await generateObject(generateOptionsAny)

    if (timeoutId) clearTimeout(timeoutId)

    const usage: TokenUsage = {
      promptTokens: result.usage?.inputTokens ?? 0,
      completionTokens: result.usage?.outputTokens ?? 0,
      totalTokens: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0),
    }

    // 触发 afterModelCall hook
    if (pm) {
      await pm.emit("afterModelCall", agentInstance, {
        response: { text: JSON.stringify(result.object), usage },
      })
    }

    return {
      object: result.object as T,
      usage,
      duration: Date.now() - startTime,
    }
  } catch (err: any) {
    if (timeoutId) clearTimeout(timeoutId)

    if (controller?.signal?.aborted || err?.name === "AbortError") {
      throw new TimeoutError(
        `结构化输出超时（${options.timeout}ms）`,
        options.timeout!,
      )
    }

    throw new ModelError(
      `结构化输出失败：${err.message}`,
      err,
    )
  }
}
