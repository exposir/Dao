---
layout: home

hero:
  name: "Dao"
  text: "大道至简的 AI Agent 框架"
  tagline: 直觉优先 · 渐进式 · 开源模型友好
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: API 文档
      link: /api
    - theme: alt
      text: GitHub
      link: https://github.com/exposir/Dao

features:
  - icon: 🎯
    title: 描述角色，而非配置机器
    details: 用 role / tools / steps / rules 描述你的 Agent，像写需求文档一样自然。
  - icon: 📈
    title: 渐进式复杂度
    details: 3 行代码起步，按需扩展。每一层只加一两行代码，复杂度线性增长。
  - icon: 🤖
    title: 开源模型友好
    details: DeepSeek / Qwen / Kimi 等开源模型开箱即用，一个环境变量搞定。
  - icon: 🔌
    title: 插件生态
    details: 核心精简，能力通过插件扩展。8 个 Hook 覆盖全生命周期，V2.5 支持修改 prompt 和消息。
  - icon: 🚀
    title: 极致轻量
    details: 核心代码不到 3000 行，运行时仅 2 个依赖。一个包搞定。
  - icon: 🏢
    title: 生产可靠
    details: 自动重试、Fallback 模型、超时保护、错误分类、输出校验——不是预留，是已实现。

---

## 与主流框架对比

|                  | Dao                               | Mastra         | LangChain.js   | Vercel AI SDK  |
| ---------------- | --------------------------------- | -------------- | -------------- | -------------- |
| **核心代码量**   | ~3000 行                          | 5000+ 行（28 个包） | 庞大           | N/A（底层库）  |
| **上手**         | 3 行，无 Zod                      | 多层配置 + Zod | 多层抽象 + Zod | 自行编排 + Zod |
| **多 Agent**     | 内置 `team()` + `delegates`       | Network        | 需 LangGraph   | 无             |
| **步骤引擎**     | 串行/并行/条件/等待/校验          | 链式 API       | 需 LangGraph   | 无             |
| **生产容错**     | 重试 + 超时 + fallback + 成本上限 | 部分           | 部分           | 自行实现       |
| **多模态 + MCP** | 内置                              | 部分           | 额外配置       | 部分           |
| **插件 + 交互**  | 8 hook + prompt 可变 + `onAsk`    | 有限           | Callbacks      | 无             |
| **共享状态**     | `state` + `workspace`             | 无             | 无             | 无             |
| **中文**         | i18n + 开源模型优先               | 英文为主       | 英文为主       | 英文为主       |

> **定位**：Mastra 大而重，LangChain 抽象复杂，AI SDK 灵活但太底层。**Dao 追求开箱即用 + 渐进复杂**。

## 开始使用

```bash
npm install dao-ai
```

```typescript
import "dotenv/config"
import { agent } from "dao-ai"

const bot = agent({ model: "deepseek/deepseek-chat" })
console.log(await bot.chat("你好"))
```

[查看完整快速开始 →](/guide/getting-started)
