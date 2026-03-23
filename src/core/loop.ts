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
import crypto from "node:crypto"
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
  MessageInput,
  ContentPart,
} from "./types.js"
import { resolveModel, detectDefaultModel } from "./model.js"
import { getGlobalConfig } from "./config.js"
import { compileRules } from "../rules.js"
import { ModelError, ToolError, TimeoutError, CostLimitError } from "./errors.js"
import { AbortError } from "../engine.js"
import type { PluginManager } from "../plugin.js"

/**
 * 从 AI SDK 返回的 usage 中提取标准化的 TokenUsage
 * 兼容 v2（平铺数字）和 v3（嵌套 { total }）两种格式
 */
function extractUsage(raw: any): TokenUsage {
  if (!raw) return { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  // v3 嵌套格式: { inputTokens: { total: N }, outputTokens: { total: N } }
  const input = typeof raw.inputTokens === "object"
    ? raw.inputTokens?.total ?? 0
    : raw.inputTokens ?? raw.promptTokens ?? 0
  const output = typeof raw.outputTokens === "object"
    ? raw.outputTokens?.total ?? 0
    : raw.outputTokens ?? raw.completionTokens ?? 0
  return { promptTokens: input, completionTokens: output, totalTokens: input + output }
}

/**
 * 将 MessageInput 转换为 AI SDK 消息内容格式
 * - string → 纯文本字符串
 * - ContentPart[] → AI SDK content parts 数组
 */
function toMessageContent(input: MessageInput): string | Array<any> {
  if (typeof input === "string") return input
  return input.map(part => {
    switch (part.type) {
      case "text":
        return { type: "text", text: part.text }
      case "image":
        return { type: "image", image: part.image }
      case "file":
        return {
          type: "file",
          data: part.data,
          mediaType: part.mediaType,
          ...(part.filename ? { filename: part.filename } : {}),
        }
    }
  })
}

/** 从 MessageInput 中提取纯文本（用于日志、插件等场景） */
function extractText(input: MessageInput): string {
  if (typeof input === "string") return input
  return input
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map(p => p.text)
    .join("\n")
}

/** 工具中止引用，用于从工具内部中止 Agent Loop */
interface AbortRef {
  reason: string | null
  controller: AbortController
}

/** 将 ToolInstance[] 转为 AI SDK 的 tools 格式 */
function toAITools(
  tools: ToolInstance[],
  agentInstance: AgentInstance,
  pm?: PluginManager,
  options?: AgentOptions,
  onToolCall?: (name: string, params: any, result: any) => void,
  abortRef?: AbortRef,
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
        if (t.confirm) {
          if (!options?.onConfirm) {
            throw new Error(`工具 "${t.name}" 要求确认执行，但未配置 onConfirm 回调`)
          }
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
            abort: (reason?: string) => {
              const msg = reason ?? "工具中止执行"
              // 存储中止原因，并通过 AbortController 信号中断 generateText/streamText
              if (abortRef) {
                abortRef.reason = msg
                abortRef.controller.abort()
              }
              throw new AbortError(msg)
            },
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
          // AbortError 由用户显式调用 ctx.abort()，应穿透到上层中止 Agent 循环
          if (err instanceof AbortError) throw err

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
  task: MessageInput,
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
  // tools 在 abortRef 之后初始化（见下方）
  let tools: ToolSet | undefined

  const messages: ModelMessage[] = [
    ...messageHistory,
    { role: "user", content: toMessageContent(task) } as ModelMessage,
  ]

  const startTime = Date.now()

  // AbortController：同时用于超时控制和工具中止
  const controller = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  if (options.timeout) {
    timeoutId = setTimeout(() => controller.abort(), options.timeout)
  }

  // 工具中止引用：工具调用 ctx.abort() 时会设置 reason 并触发 controller.abort()
  const abortRef: AbortRef = { reason: null, controller }

  // 触发 beforeModelCall hook
  if (pm) {
    const { skipped } = await pm.emit("beforeModelCall", agentInstance, { prompt: systemPrompt })
    if (skipped) {
      if (timeoutId) clearTimeout(timeoutId)
      return { requestId: crypto.randomUUID(), output: "", turns: [], usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, duration: 0 }
    }
  }

  // 初始化 tools（需要 abortRef）
  tools = options.tools?.length ? toAITools(options.tools, agentInstance, pm, options, undefined, abortRef) : undefined

  try {
    const result = await generateText({
      model,
      system: systemPrompt || undefined,
      messages,
      tools,
      temperature: options.temperature,
      maxOutputTokens: options.maxTokens,
      maxRetries: options.retry?.maxRetries ?? 2,
      abortSignal: controller.signal,
      stopWhen: stepCountIs(maxTurns),
      providerOptions: {
        openai: { strictJsonSchema: false },
      },
    })

    if (timeoutId) clearTimeout(timeoutId)

    // 工具调用了 ctx.abort() 但 AI SDK 内部捕获了异常并完成了后续调用
    if (abortRef.reason) {
      throw new AbortError(abortRef.reason)
    }

    const usage = extractUsage(result.totalUsage)

    // 成本上限检查
    if (options.maxCostPerRun && usage.totalTokens > options.maxCostPerRun) {
      throw new CostLimitError(usage.totalTokens, options.maxCostPerRun)
    }

    // 触发 afterModelCall hook
    if (pm) {
      await pm.emit("afterModelCall", agentInstance, {
        response: { text: result.text, usage },
      })
    }


    // 收集轮次记录
    const turnResults = result.steps?.map((step, i) => ({
      turn: `turn-${i + 1}`,
      result: step.text || null,
    })) ?? []

    return {
      requestId: crypto.randomUUID(),
      output: result.text,
      turns: turnResults,
      usage,
      duration: Date.now() - startTime,
    }
  } catch (err: any) {
    if (timeoutId) clearTimeout(timeoutId)

    // ctx.abort() 抛出的 AbortError 需要优先穿透，不走超时/fallback 逻辑
    if (err instanceof AbortError) throw err

    // CostLimitError 直接穿透，不走 fallback
    if (err instanceof CostLimitError) throw err

    // 工具内部调用了 ctx.abort()，通过 AbortController 中断了 generateText
    // AI SDK 会抛出原生 AbortError（name === "AbortError"），需要检查 abortRef 来区分
    if (abortRef.reason) {
      throw new AbortError(abortRef.reason)
    }

    const isTimeout = controller.signal.aborted || err?.name === "AbortError"

    // 有 fallbackModel 时，超时和普通错误都走 fallback
    if (options.fallbackModel) {
      // 给 fallback 独立的超时控制
      const fbController = options.timeout ? new AbortController() : undefined
      const fbTimeoutId = options.timeout
        ? setTimeout(() => fbController!.abort(), options.timeout)
        : undefined
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
          abortSignal: fbController?.signal,
          stopWhen: stepCountIs(maxTurns),
          providerOptions: {
            openai: { strictJsonSchema: false },
          },
        })

        if (fbTimeoutId) clearTimeout(fbTimeoutId)

        const fallbackUsage = extractUsage(fallbackResult.totalUsage)
        if (pm) {
          await pm.emit("afterModelCall", agentInstance, {
            response: { text: fallbackResult.text, usage: fallbackUsage },
          })
        }

        const turnResults = fallbackResult.steps?.map((step, i) => ({
          turn: `fallback-turn-${i + 1}`,
          result: step.text || null,
        })) ?? []

        return {
          requestId: crypto.randomUUID(),
          output: fallbackResult.text,
          turns: turnResults,
          usage: fallbackUsage,
          duration: Date.now() - startTime,
        }
      } catch {
        // fallback 也失败，走下方错误抛出
      } finally {
        if (fbTimeoutId) clearTimeout(fbTimeoutId)
      }
    }

    if (isTimeout) {
      throw new TimeoutError(
        `模型调用超时（${options.timeout}ms）`,
        options.timeout!,
      )
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
  task: MessageInput,
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
  let hasExecutedTools = false  // 独立标志，不受 shift() 清空影响
  const onToolCall = (name: string, params: any, result: any) => {
    hasExecutedTools = true
    toolCallEvents.push({ type: "tool_call", data: { tool: name, params, result } })
  }
  // tools 在 abortRef 之后初始化（见下方）
  let tools: ToolSet | undefined

  const messages: ModelMessage[] = [
    ...messageHistory,
    { role: "user", content: toMessageContent(task) } as ModelMessage,
  ]

  // AbortController：同时用于超时控制和工具中止
  const controller = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  if (options.timeout) {
    timeoutId = setTimeout(() => controller.abort(), options.timeout)
  }

  // 工具中止引用
  const abortRef: AbortRef = { reason: null, controller }

  // 触发 beforeModelCall hook
  if (pm) {
    const { skipped } = await pm.emit("beforeModelCall", agentInstance, { prompt: systemPrompt })
    if (skipped) {
      if (timeoutId) clearTimeout(timeoutId)
      yield { type: "done", data: null }
      return
    }
  }

  let hasYieldedText = false

  // 初始化 tools（需要 abortRef）
  tools = options.tools?.length ? toAITools(options.tools, agentInstance, pm, options, onToolCall, abortRef) : undefined

  try {
    const result = streamText({
      model,
      system: systemPrompt || undefined,
      messages,
      tools,
      temperature: options.temperature,
      maxOutputTokens: options.maxTokens,
      maxRetries: options.retry?.maxRetries ?? 2,
      abortSignal: controller.signal,
      stopWhen: stepCountIs(maxTurns),
    })

    let fullText = ""
    for await (const part of result.textStream) {
      if (part) hasYieldedText = true
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

    // 工具调用了 ctx.abort() 但 AI SDK 内部捕获了异常并完成了后续调用
    if (abortRef.reason) {
      throw new AbortError(abortRef.reason)
    }

    // 获取真实用量
    const totalUsage = await result.totalUsage
    const usage = extractUsage(totalUsage)

    // 成本上限检查
    if (options.maxCostPerRun && usage.totalTokens > options.maxCostPerRun) {
      throw new CostLimitError(usage.totalTokens, options.maxCostPerRun)
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

    if (err instanceof AbortError) throw err

    // CostLimitError 直接穿透
    if (err instanceof CostLimitError) throw err

    // 工具中止
    if (abortRef.reason) {
      throw new AbortError(abortRef.reason)
    }

    if (controller.signal.aborted || err?.name === "AbortError") {
      // 超时：如果有 fallback 且没有已执行的工具，走 fallback
      if (options.fallbackModel && !hasYieldedText && !hasExecutedTools) {
        try {
          const fallbackOptions = {
            ...options,
            model: options.fallbackModel,
            modelProvider: undefined,
            fallbackModel: undefined,
            timeout: options.timeout,
          }
          const childGen = runLoopStream(fallbackOptions, task, messageHistory, agentInstance, pm)
          yield* childGen
          return
        } catch {
          // fallback 也失败，抛超时错误
        }
      }
      throw new TimeoutError(
        `流式调用超时（${options.timeout}ms）`,
        options.timeout!,
      )
    }

    // 非超时错误：有 fallback 且无已执行工具时走 fallback
    if (options.fallbackModel && !hasYieldedText && !hasExecutedTools) {
      try {
        const fallbackOptions = {
          ...options,
          model: options.fallbackModel,
          modelProvider: undefined,
          fallbackModel: undefined,
        }
        const childGen = runLoopStream(fallbackOptions, task, messageHistory, agentInstance, pm)
        yield* childGen
        return
      } catch (fbErr: any) {
        throw new ModelError(
          `流式调用在备用模型上也失败：${fbErr.message}`,
          fbErr,
        )
      }
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
      return { object: {} as T, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, duration: 0 }
    }
  }

  let resolvedSchema = generateOptions.schema
  if (resolvedSchema && typeof resolvedSchema === "object" && typeof resolvedSchema.parse !== "function" && !resolvedSchema.jsonSchema) {
    resolvedSchema = jsonSchema(resolvedSchema as any)
  }

  try {
    const generateOptionsAny: any = {
      model,
      system: systemPrompt || undefined,
      prompt: task,
      schema: resolvedSchema,
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

    const usage = extractUsage(result.usage)

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

    if (err instanceof AbortError) throw err

    const isTimeout = controller?.signal?.aborted || err?.name === "AbortError"

    // 有 fallbackModel 时，超时和普通错误都走 fallback
    if (options.fallbackModel) {
      // 给 fallback 独立的超时控制
      const fbController = options.timeout ? new AbortController() : undefined
      const fbTimeoutId = options.timeout
        ? setTimeout(() => fbController!.abort(), options.timeout)
        : undefined
      try {

        const fallbackModel = await resolveModel(options.fallbackModel)
        const fallbackOptionsAny: any = {
          model: fallbackModel,
          system: systemPrompt || undefined,
          prompt: task,
          schema: resolvedSchema,
          schemaName: generateOptions.schemaName ?? "result",
          schemaDescription: generateOptions.schemaDescription,
          mode: "json", // Fix 5: 与主路径保持一致
          temperature: options.temperature,
          maxOutputTokens: options.maxTokens,
          maxRetries: options.retry?.maxRetries ?? 2,
          abortSignal: fbController?.signal,
        }
        const fallbackResult = await generateObject(fallbackOptionsAny)
        
        if (fbTimeoutId) clearTimeout(fbTimeoutId)

        const fallbackUsage = extractUsage(fallbackResult.usage)

        // Fix 6: fallback 成功后也触发 afterModelCall hook
        if (pm) {
          await pm.emit("afterModelCall", agentInstance, {
            response: { text: JSON.stringify(fallbackResult.object), usage: fallbackUsage },
          })
        }

        return {
          object: fallbackResult.object as T,
          usage: fallbackUsage,
          duration: Date.now() - startTime,
        }
      } catch (fbErr: any) {
        if (fbTimeoutId) clearTimeout(fbTimeoutId)
        throw isTimeout
          ? new TimeoutError(`结构化输出超时（${options.timeout}ms）`, options.timeout!)
          : new ModelError(`结构化输出在备用模型上也失败：${fbErr.message}`, fbErr)
      }
    }

    if (isTimeout) {
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
