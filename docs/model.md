# 模型层设计文档

---

## 1. 设计目标

- 基于 Vercel AI SDK，不重新造轮子
- 统一 `provider/model` 字符串格式
- 开源模型优先支持
- 开发者只需安装 provider 包、配置 `.env`，无需编写模型初始化代码

---

## 2. Provider 注册表

```typescript
interface ProviderEntry {
  /** provider 工厂函数 */
  create: (apiKey: string) => LanguageModelProvider
  /** 环境变量名 */
  envKey: string
  /** 默认模型 */
  defaultModel: string
}

const PROVIDERS: Record<string, ProviderEntry> = {
  // 开源模型（优先）
  deepseek: {
    create: (key) => createDeepSeek({ apiKey: key }),
    envKey: "DEEPSEEK_API_KEY",
    defaultModel: "deepseek-chat",
  },
  moonshotai: {
    create: (key) => createMoonshot({ apiKey: key }),
    envKey: "MOONSHOT_API_KEY",
    defaultModel: "kimi-k2.5",
  },
  alibaba: {
    create: (key) => createAlibaba({ apiKey: key }),
    envKey: "ALIBABA_API_KEY",
    defaultModel: "qwen3-max",
  },
  zhipu: {
    create: (key) => createZhipu({ apiKey: key }),
    envKey: "ZHIPU_API_KEY",
    defaultModel: "glm-4-plus",
  },

  // 商业模型
  openai: {
    create: (key) => createOpenAI({ apiKey: key }),
    envKey: "OPENAI_API_KEY",
    defaultModel: "gpt-4o",
  },
  google: {
    create: (key) => createGoogleGenerativeAI({ apiKey: key }),
    envKey: "GOOGLE_API_KEY",
    defaultModel: "gemini-2.5-pro",
  },
  anthropic: {
    create: (key) => createAnthropic({ apiKey: key }),
    envKey: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-4-5",
  },
}
```

---

## 3. 模型解析

```typescript
function resolveModel(modelString: string): LanguageModel {
  // 1. 解析 "provider/model" 格式
  const [providerName, modelId] = modelString.split("/", 2)

  // 2. 查找 provider
  const provider = PROVIDERS[providerName]
  if (!provider) {
    throw new Error(`未知的模型 provider: ${providerName}`)
  }

  // 3. 读取 API Key
  const apiKey = process.env[provider.envKey]
  if (!apiKey) {
    throw new Error(
      `请设置环境变量 ${provider.envKey}。\n` +
      `在 .env 文件中添加：${provider.envKey}=your-api-key`
    )
  }

  // 4. 创建模型实例
  const instance = provider.create(apiKey)
  return instance(modelId || provider.defaultModel)
}
```

---

## 4. 默认模型

```typescript
// 不指定 model 时的默认行为
function getDefaultModel(): string {
  // 按优先级检查环境变量
  if (process.env.DEEPSEEK_API_KEY) return "deepseek/deepseek-chat"
  if (process.env.MOONSHOT_API_KEY) return "moonshotai/kimi-k2.5"
  if (process.env.ALIBABA_API_KEY) return "alibaba/qwen3-max"
  if (process.env.OPENAI_API_KEY) return "openai/gpt-4o"
  if (process.env.GOOGLE_API_KEY) return "google/gemini-2.5-pro"

  throw new Error(
    "未找到任何模型 API Key。\n" +
    "请在 .env 文件中至少配置一个：\n" +
    "  DEEPSEEK_API_KEY=sk-xxx\n" +
    "  OPENAI_API_KEY=sk-xxx"
  )
}
```

> **开源模型优先**：默认模型优先检查开源模型的 API Key。

---

## 5. 自定义 Provider

```typescript
import { registerProvider } from "dao"

// 注册百度文心（通过 OpenAI 兼容接口）
registerProvider("baidu", {
  create: (key) => createOpenAI({
    apiKey: key,
    baseURL: "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop",
  }),
  envKey: "BAIDU_API_KEY",
  defaultModel: "ernie-4.0",
})

// 使用
const bot = agent({ model: "baidu/ernie-4.0" })
```

---

## 6. 依赖的 Vercel AI SDK 包

| 包名 | 用途 |
|---|---|
| `ai` | 核心（generateText, streamText） |
| `@ai-sdk/deepseek` | DeepSeek |
| `@ai-sdk/openai` | OpenAI + OpenAI 兼容 |
| `@ai-sdk/google` | Gemini |
| `@ai-sdk/anthropic` | Claude |
| `@ai-sdk/moonshotai` | 月之暗面 Kimi |
| `@ai-sdk/alibaba` | 通义千问 Qwen |
| `@ai-sdk/zhipu` | 智谱 GLM |

按需安装。Dao 的 `package.json` 中这些作为 `peerDependencies`，用户只安装自己需要的 provider。
