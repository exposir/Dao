# 模型层设计文档

---

## 1. 设计目标

- 基于 Vercel AI SDK，不重新造轮子
- 统一 `provider/model` 字符串格式
- 开源模型优先支持
- 开发者只需安装 provider 包、配置 `.env`，无需编写模型初始化代码

---

## 2. 内置 Provider 支持

### 开箱即用（framework dependency）

| Provider | 模型字符串 | 环境变量 | 默认模型 | 依赖包 |
|---|---|---|---|---|
| DeepSeek | `deepseek/deepseek-chat` | `DEEPSEEK_API_KEY` | deepseek-chat | `@ai-sdk/openai`（兼容模式） |
| OpenAI | `openai/gpt-4o` | `OPENAI_API_KEY` | gpt-4o | `@ai-sdk/openai` |

> DeepSeek 通过 `@ai-sdk/openai` 的 OpenAI 兼容模式接入（baseURL 指向 `api.deepseek.com`），因此无需额外安装。

### 按需安装（peerDependency，optional）

| Provider | 模型字符串 | 环境变量 | 默认模型 | 安装命令 |
|---|---|---|---|---|
| Google | `google/gemini-2.5-pro` | `GOOGLE_GENERATIVE_AI_API_KEY` | gemini-2.5-pro | `npm i @ai-sdk/google` |
| Anthropic | `anthropic/claude-sonnet-4-5-20250514` | `ANTHROPIC_API_KEY` | claude-sonnet-4-5-20250514 | `npm i @ai-sdk/anthropic` |
| 月之暗面 | `moonshotai/kimi-k2.5` | `MOONSHOTAI_API_KEY` | kimi-k2.5 | `npm i @ai-sdk/moonshotai` |
| 通义千问 | `alibaba/qwen3-max` | `ALIBABA_API_KEY` | qwen3-max | `npm i @ai-sdk/alibaba` |
| 智谱 | `zhipu/glm-4-plus` | `ZHIPU_API_KEY` | glm-4-plus | `npm i @ai-sdk/zhipu` |

### 通过 registerProvider() 接入

任何支持 OpenAI 兼容 API 的模型都可以通过 `registerProvider()` + `@ai-sdk/openai` 接入：

| 模型 | 方式 |
|---|---|
| 百度文心 | OpenAI 兼容 baseURL |
| 零一万物 Yi | OpenAI 兼容 baseURL |
| MiniMax | OpenAI 兼容 baseURL |
| Ollama 本地模型 | OpenAI 兼容 baseURL |
| Mistral | `@ai-sdk/mistral` |
| Groq | `@ai-sdk/groq` |
| xAI (Grok) | `@ai-sdk/xai` |

---

## 3. 使用方式

```typescript
// 1. 直接指定
const bot = agent({ model: "deepseek/deepseek-chat" })

// 2. 全局默认
configure({ defaultModel: "deepseek/deepseek-chat" })
const bot = agent({}) // 使用默认模型

// 3. 不指定 → 自动检测（按优先级扫描环境变量）
// 设置 DEEPSEEK_API_KEY=sk-xxx 后：
const bot = agent({}) // 自动使用 deepseek/deepseek-chat
```

---

## 4. 自动检测优先级

不指定 model 时，框架按以下顺序检查环境变量，使用第一个找到的：

1. `DEEPSEEK_API_KEY` → `deepseek/deepseek-chat`
2. `OPENAI_API_KEY` → `openai/gpt-4o`
3. `GOOGLE_GENERATIVE_AI_API_KEY` → `google/gemini-2.5-pro`
4. `ANTHROPIC_API_KEY` → `anthropic/claude-sonnet-4-5-20250514`
5. `MOONSHOTAI_API_KEY` → `moonshotai/kimi-k2.5`
6. `ALIBABA_API_KEY` → `alibaba/qwen3-max`
7. `ZHIPU_API_KEY` → `zhipu/glm-4-plus`

> **开源模型优先**：DeepSeek 排第一。

---

## 5. 自定义 Provider

```typescript
import { registerProvider } from "dao"
import { createOpenAI } from "@ai-sdk/openai"

// 注册百度文心（OpenAI 兼容模式）
registerProvider("baidu", {
  create: async (key) => {
    const { createOpenAI } = await import("@ai-sdk/openai")
    const provider = createOpenAI({
      apiKey: key,
      baseURL: "https://aip.baidubce.com/v1",
    })
    return (modelId) => provider.chat(modelId)
  },
  envKey: "BAIDU_API_KEY",
  defaultModel: "ernie-4.0",
})

// 使用
const bot = agent({ model: "baidu/ernie-4.0" })
```

```typescript
// 注册 Ollama 本地模型
registerProvider("ollama", {
  create: async (key) => {
    const { createOpenAI } = await import("@ai-sdk/openai")
    const provider = createOpenAI({
      apiKey: "ollama",
      baseURL: "http://localhost:11434/v1",
    })
    return (modelId) => provider.chat(modelId)
  },
  envKey: "OLLAMA_API_KEY", // 随意值即可
  defaultModel: "llama3",
})

const bot = agent({ model: "ollama/llama3" })
```

---

## 6. 依赖结构

```
dao
├── dependencies（自动安装）
│   ├── ai              — AI SDK 核心
│   └── @ai-sdk/openai  — OpenAI + DeepSeek 兼容
│
├── peerDependencies（可选，按需安装）
│   ├── @ai-sdk/google
│   ├── @ai-sdk/anthropic
│   ├── @ai-sdk/moonshotai
│   ├── @ai-sdk/alibaba
│   └── @ai-sdk/zhipu
│
└── 用户自行安装（registerProvider 接入）
    ├── @ai-sdk/mistral
    ├── @ai-sdk/groq
    ├── @ai-sdk/xai
    └── ...
```
