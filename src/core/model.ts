/**
 * 道（Dao）— 模型层
 *
 * 解析 "provider/model" 格式的模型字符串，返回可用的 LanguageModel 实例。
 * 内置 provider 注册表 + 自定义 provider 注册。
 */

import type { ProviderEntry } from "./types.js"

/** 全局 provider 注册表 */
const PROVIDERS: Record<string, ProviderEntry> = {
  deepseek: {
    create: async (apiKey: string) => {
      const { createOpenAI } = await import("@ai-sdk/openai")
      const provider = createOpenAI({
        apiKey,
        baseURL: "https://api.deepseek.com",
        // @ts-ignore: 当前 AI SDK 版本类型可能缺失兼容性字段，但在实际依赖项中可生效
        compatibility: "compatible" // 兼容模式，关闭 strict json_schema 等非标准特性
      })
      // 返回包装后的 provider，默认使用 chat completions 端点
      return (modelId: string) => provider.chat(modelId)
    },
    envKey: "DEEPSEEK_API_KEY",
    defaultModel: "deepseek-chat",
  },
  openai: {
    create: async (apiKey: string) => {
      const { createOpenAI } = await import("@ai-sdk/openai")
      return createOpenAI({ apiKey })
    },
    envKey: "OPENAI_API_KEY",
    defaultModel: "gpt-4o",
  },
  google: {
    create: async (apiKey: string) => {
      // @ts-ignore — peerDependency，用户按需安装
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google")
      return createGoogleGenerativeAI({ apiKey })
    },
    envKey: "GOOGLE_GENERATIVE_AI_API_KEY",
    defaultModel: "gemini-2.5-pro",
  },
  anthropic: {
    create: async (apiKey: string) => {
      // @ts-ignore — peerDependency，用户按需安装
      const { createAnthropic } = await import("@ai-sdk/anthropic")
      return createAnthropic({ apiKey })
    },
    envKey: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-4-5-20250514",
  },
  moonshotai: {
    create: async (apiKey: string) => {
      // @ts-ignore — peerDependency，用户按需安装
      const { createMoonshotAI } = await import("@ai-sdk/moonshotai")
      return createMoonshotAI({ apiKey })
    },
    envKey: "MOONSHOTAI_API_KEY",
    defaultModel: "kimi-k2.5",
  },
  alibaba: {
    create: async (apiKey: string) => {
      // @ts-ignore — peerDependency，用户按需安装
      const { createAlibaba } = await import("@ai-sdk/alibaba")
      return createAlibaba({ apiKey })
    },
    envKey: "ALIBABA_API_KEY",
    defaultModel: "qwen3-max",
  },
  zhipu: {
    create: async (apiKey: string) => {
      // @ts-ignore — peerDependency，用户按需安装
      const { createZhipu } = await import("@ai-sdk/zhipu")
      return createZhipu({ apiKey })
    },
    envKey: "ZHIPU_API_KEY",
    defaultModel: "glm-4-plus",
  },
}

/**
 * 注册自定义 provider
 */
export function registerProvider(name: string, entry: ProviderEntry): void {
  PROVIDERS[name] = entry
}

/**
 * 解析模型字符串，返回 LanguageModel
 */
export async function resolveModel(modelString: string) {
  const [providerName, ...modelParts] = modelString.split("/")
  const modelId = modelParts.join("/") || undefined

  const entry = PROVIDERS[providerName]
  if (!entry) {
    throw new Error(
      `未知的 provider: "${providerName}"。` +
      `可用的 provider: ${Object.keys(PROVIDERS).join(", ")}。` +
      `如需自定义 provider，请使用 registerProvider()。`
    )
  }

  const apiKey = process.env[entry.envKey]
  if (!apiKey) {
    throw new Error(
      `缺少环境变量 ${entry.envKey}。` +
      `请在 .env 文件或环境变量中设置该值。`
    )
  }

  const provider = await entry.create(apiKey)
  return provider(modelId || entry.defaultModel)
}

/**
 * 自动检测可用的模型
 */
export function detectDefaultModel(): string | undefined {
  for (const [name, entry] of Object.entries(PROVIDERS)) {
    if (process.env[entry.envKey]) {
      return `${name}/${entry.defaultModel}`
    }
  }
  return undefined
}

/** 获取当前所有已注册的 provider 名称 */
export function getProviderNames(): string[] {
  return Object.keys(PROVIDERS)
}
