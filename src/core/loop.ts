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

import { generateText, streamText, stepCountIs, jsonSchema } from "ai"
import type { ModelMessage, ToolSet } from "ai"
import type {
  AgentOptions,
  AgentInstance,
  ToolInstance,
  ToolContext,
  RunResult,
  RunEvent,
  TokenUsage,
} from "./types.js"
import { resolveModel, detectDefaultModel } from "./model.js"
import { getGlobalConfig } from "./config.js"
import { compileRules } from "../rules.js"
import { ModelError, ToolError, TimeoutError } from "./errors.js"
import type { PluginManager } from "../plugin.js"

/** 将 ToolInstance[] 转为 AI SDK 的 tools 格式 */
function toAITools(tools: ToolInstance[], agentInstance: AgentInstance, pm?: PluginManager): ToolSet {
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

        try {
          const ctx: ToolContext = {
            agent: agentInstance,
            abort: () => { throw new Error("工具中止执行") },
          }
          const output = await t.execute(params, ctx)
          const result = typeof output === "string" ? output : JSON.stringify(output)

          // 触发 afterToolCall hook
          if (pm) {
            await pm.emit("afterToolCall", agentInstance, { tool: t.name, result })
          }

          return result
        } catch (err: any) {
          // 包装为 ToolError（但不阻断 Agent Loop，返回错误信息让 LLM 处理）
          const toolErr = err instanceof ToolError
            ? err
            : new ToolError(`工具 "${t.name}" 执行失败：${err.message}`, t.name, err)

          if (pm) {
            await pm.emit("afterToolCall", agentInstance, { tool: t.name, result: toolErr.message })
          }

          return toolErr.message
        }
      },
    } as any
  }
  return result
}

/** 组装 system prompt */
function buildSystemPrompt(options: AgentOptions): string {
  const parts: string[] = []

  if (options.systemPrompt) {
    parts.push(options.systemPrompt)
  }

  if (options.role) {
    parts.push(`你的角色是：${options.role}`)
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

  if (!modelString) {
    throw new Error(
      "未指定模型。请通过 agent({ model: \"provider/model\" }) 或 " +
      "configure({ defaultModel: \"provider/model\" }) 指定，" +
      "或设置环境变量（如 DEEPSEEK_API_KEY）让框架自动检测。"
    )
  }

  const model = options.modelProvider ?? await resolveModel(modelString)
  const systemPrompt = buildSystemPrompt(options)
  const tools = options.tools?.length ? toAITools(options.tools, agentInstance, pm) : undefined

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
      await pm.emit("afterModelCall", agentInstance, { response: result.text })
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
): AsyncIterable<RunEvent> {
  const globalConfig = getGlobalConfig()
  const maxTurns = options.maxTurns ?? globalConfig.defaultMaxTurns ?? 50
  const modelString = options.model ?? globalConfig.defaultModel ?? detectDefaultModel()

  if (!modelString) {
    throw new Error("未指定模型。")
  }

  const model = options.modelProvider ?? await resolveModel(modelString)
  const systemPrompt = buildSystemPrompt(options)
  const tools = options.tools?.length ? toAITools(options.tools, agentInstance) : undefined

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

    for await (const part of result.textStream) {
      yield { type: "text", data: part }
    }

    if (timeoutId) clearTimeout(timeoutId)
    yield { type: "done", data: null }
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
