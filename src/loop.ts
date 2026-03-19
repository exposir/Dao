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
  ToolInstance,
  RunResult,
  RunEvent,
  TokenUsage,
} from "./types.js"
import { resolveModel, detectDefaultModel } from "./model.js"
import { getGlobalConfig } from "./config.js"

/** 将 ToolInstance[] 转为 AI SDK 的 tools 格式 */
function toAITools(tools: ToolInstance[]): ToolSet {
  const result: ToolSet = {}
  for (const t of tools) {
    result[t.name] = {
      description: t.description,
      // AI SDK v5: Tool 类型使用 inputSchema（Schema 对象），不是 parameters
      inputSchema: jsonSchema<any>({
        type: "object",
        properties: t.schema.properties,
        required: t.schema.required,
        additionalProperties: false,
      }),
      execute: async (params: any) => {
        const output = await t.execute(params)
        return typeof output === "string" ? output : JSON.stringify(output)
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

  if (options.rules?.focus?.length) {
    parts.push(`你应该重点关注：${options.rules.focus.join("、")}`)
  }
  if (options.rules?.reject?.length) {
    parts.push(`你不允许做以下事情：${options.rules.reject.join("、")}`)
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
  const tools = options.tools?.length ? toAITools(options.tools) : undefined

  const messages: ModelMessage[] = [
    ...messageHistory,
    { role: "user", content: task },
  ]

  const startTime = Date.now()

  const result = await generateText({
    model,
    system: systemPrompt || undefined,
    messages,
    tools,
    stopWhen: stepCountIs(maxTurns),
    providerOptions: {
      openai: { strictJsonSchema: false },
    },
  })

  // 提取 token 用量
  const usage: TokenUsage = {
    promptTokens: result.totalUsage?.inputTokens ?? 0,
    completionTokens: result.totalUsage?.outputTokens ?? 0,
    totalTokens: (result.totalUsage?.inputTokens ?? 0) + (result.totalUsage?.outputTokens ?? 0),
  }

  // 收集步骤记录
  const stepResults = result.steps?.map((step, i) => ({
    step: `turn-${i + 1}`,
    result: step.text || null,
  })) ?? []

  return {
    output: result.text,
    steps: stepResults,
    usage,
    duration: Date.now() - startTime,
  }
}

/**
 * 执行 Agent Loop（流式）
 */
export async function* runLoopStream(
  options: AgentOptions,
  task: string,
  messageHistory: ModelMessage[],
): AsyncIterable<RunEvent> {
  const globalConfig = getGlobalConfig()
  const maxTurns = options.maxTurns ?? globalConfig.defaultMaxTurns ?? 50
  const modelString = options.model ?? globalConfig.defaultModel ?? detectDefaultModel()

  if (!modelString) {
    throw new Error("未指定模型。")
  }

  const model = options.modelProvider ?? await resolveModel(modelString)
  const systemPrompt = buildSystemPrompt(options)
  const tools = options.tools?.length ? toAITools(options.tools) : undefined

  const messages: ModelMessage[] = [
    ...messageHistory,
    { role: "user", content: task },
  ]

  const result = streamText({
    model,
    system: systemPrompt || undefined,
    messages,
    tools,
    stopWhen: stepCountIs(maxTurns),
  })

  for await (const part of result.textStream) {
    yield { type: "text", data: part }
  }

  yield { type: "done", data: null }
}
