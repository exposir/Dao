[English](./README.en.md) | 中文

<div align="center">

# Dao

**大道至简的 AI Agent 框架**

[![npm version](https://img.shields.io/npm/v/dao-ai.svg?style=flat-square&color=cb3837)](https://www.npmjs.com/package/dao-ai)
[![license](https://img.shields.io/npm/l/dao-ai.svg?style=flat-square&color=blue)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![test](https://img.shields.io/badge/tests-163%20passed-brightgreen?style=flat-square)](./tests)

3 行代码创建 AI Agent。不需要 Zod，不需要 LangChain。
DeepSeek / Qwen / Gemini / GPT 开箱即用。

```
chat()  →  tools  →  steps  →  rules  →  memory  →  team  →  plugins
 简单 ─────────────────────────────────────────────────────────► 复杂
```

每一层只加一两行代码，复杂度线性增长，不跳跃。

</div>

---

## 快速开始

```bash
npm install dao-ai
```

```env
# .env
DEEPSEEK_API_KEY=sk-xxx
```

```typescript
import "dotenv/config"
import { agent } from "dao-ai"

const bot = agent({ model: "deepseek/deepseek-chat" })
console.log(await bot.chat("你好"))
```

---

## 为什么选 Dao？

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

---

## ⭐ 真实案例：PR 自动审查

输入任意 GitHub PR URL，Agent 自动获取 diff 并生成结构化审查意见：

```bash
npx tsx examples/pr-reviewer.ts https://github.com/facebook/react/pull/32123
```

```typescript
import { agent, tool } from "dao-ai"

// 接入 GitHub API，获取 PR 详情和文件列表
const fetchPRDetails = tool({
  name: "fetchPRDetails",
  params: { prUrl: "GitHub PR URL" },
  run: async ({ prUrl }) => { /* 调用 GitHub API */ },
})

// Agent 负责审查逻辑（fetch diff → 分析 → 输出意见）
const reviewer = agent({
  role: "资深代码审查员",
  model: "deepseek/deepseek-chat",
  tools: [fetchPRDetails, fetchFileDiff],
  rules: { focus: ["安全漏洞", "逻辑错误"], reject: ["修改代码"] },
})

await reviewer.run("审查这个 PR：https://github.com/owner/repo/pull/123")
```

完整代码见 [examples/pr-reviewer.ts](examples/pr-reviewer.ts)。

---

## 渐进式示例

**1. 3 行跑通** — 最简用法：

```typescript
const bot = agent({ model: "deepseek/deepseek-chat" })
await bot.chat("你好")
```

**2. 加工具** — 给 Agent 能力，让它能读文件、执行命令：

```typescript
import { agent, readFile, listDir } from "dao-ai"

const auditor = agent({
  model: "deepseek/deepseek-chat",
  goal: "找出代码中的 bug",
  tools: [readFile, listDir],
})
const result = await auditor.run("审查 src/ 目录")
```

> Dao 内置 7 个常用工具：`readFile` / `writeFile` / `deleteFile` / `listDir` / `runCommand` / `search` / `fetchUrl`

**3. 加步骤** — 定义执行流程，支持串行、并行、条件分支：

```typescript
const reviewer = agent({
  model: "deepseek/deepseek-chat",
  role: "代码审查员",
  tools: [readFile, listDir],
  steps: [
    "了解项目结构",
    { parallel: ["分析前端代码", "分析后端代码"] },
    "生成审查报告",
  ],
})
```

**4. 完整功能** — 团队协作 + 规则约束 + 插件 + 容错，按需叠加：

```typescript
import { agent, team, logger } from "dao-ai"

const squad = team({
  members: {
    researcher: agent({ model: "deepseek/deepseek-chat", role: "研究员", tools: [search] }),
    writer: agent({
      model: "deepseek/deepseek-chat",
      role: "作家",
      rules: { reject: ["不要编造数据"] },
      memory: true,
      fallbackModel: "openai/gpt-4o",
      maxCostPerRun: 100000,
    }),
  },
  plugins: [logger()],
})
await squad.run("写一篇关于 AI Agent 的深度报告")
```

---

## 核心能力

<details>
<summary><b>🛠️ 工具定义</b></summary>

```typescript
import { tool } from "dao-ai"

// 一个字符串 = type: "string" + description，不需要 Zod
const readFile = tool({
  name: "readFile",
  description: "读取文件内容",
  params: { path: "文件路径" },
  run: ({ path }) => fs.readFileSync(path, "utf-8"),
})

// 需要用户确认的危险操作
const deleteFile = tool({
  name: "deleteFile",
  description: "删除文件",
  params: { path: "文件路径" },
  run: ({ path }) => fs.unlinkSync(path),
  confirm: true,
})
```

</details>

<details>
<summary><b>🖼️ 多模态 + MCP</b></summary>

```typescript
// 图片 + 文本
await bot.chat([
  { type: "text", text: "这张图片里有什么？" },
  { type: "image", image: "https://example.com/photo.jpg" },
])

// 一行接入 MCP server
const tools = await mcpTools({ url: "http://localhost:3100/sse" })
const bot = agent({ model: "deepseek/deepseek-chat", tools })
```

</details>

<details>
<summary><b>💬 运行中提问 + 共享状态</b></summary>

```typescript
// Agent 运行中主动暂停向用户提问
const bot = agent({
  model: "deepseek/deepseek-chat",
  role: "代码审查员",
  tools: [readFile],
  onAsk: async (question) => await readline.question(question),
})

// 多次 run 之间共享状态
bot.state.set("todos", [])
await bot.run("第一个任务")
```

</details>

<details>
<summary><b>🔌 插件系统</b></summary>

```typescript
import { plugin } from "dao-ai"

// 8 个生命周期 hook，V2.5 支持修改 prompt 和消息
const injector = plugin({
  name: "rag-injector",
  hooks: {
    beforeModelCall: async (ctx) => {
      const docs = await vectorDb.search(ctx.prompt)
      ctx.systemPrompt += `\n\n参考资料：\n${docs.join("\n")}`
    },
  },
})
```

</details>

<details>
<summary><b>🧪 测试支持</b></summary>

```typescript
import { agent, mockModel } from "dao-ai"

// 不需要真实 API Key，用 mockModel 写单测
const bot = agent({ modelProvider: mockModel(["你好", "再见"]) })

expect(await bot.chat("第一句")).toBe("你好")
expect(await bot.chat("第二句")).toBe("再见")
```

</details>

<details>
<summary><b>🌐 国际化 + 可观测</b></summary>

```typescript
import { setLocale, configure, telemetryPlugin } from "dao-ai"

setLocale("en") // 内置错误信息切换为英文

configure({
  globalPlugins: [
    telemetryPlugin({ serviceName: "my-app", recordContent: true }),
  ],
})
```

</details>

---

## 路线图

| 阶段     | 内容                                                       | 状态 |
| -------- | ---------------------------------------------------------- | :--: |
| **V0.1** | agent + tool + loop + memory                               |  ✅  |
| **V0.5** | steps + rules + parallel + if/wait                         |  ✅  |
| **V1.x** | team + plugins + 内置工具 + 重试/超时/错误分类 + guardrail |  ✅  |
| **V2.x** | confirm + 流式 + fallback + delegates + 结构化输出 + mock  |  ✅  |
| **V2.3** | 上下文管理 + 成本控制                                      |  ✅  |
| **V2.4** | 多模态 + MCP + OTel + 国际化                               |  ✅  |
| **V2.5** | Plugin 可变性 + workspace + ask + state + 示例生态             |  ✅  |

---

## 文档

- [快速上手](./docs/guide/getting-started.md)
- [工具系统](./docs/guide/tools.md)
- [插件系统](./docs/guide/plugins.md)
- [团队协作](./docs/guide/team.md)
- [API 参考](./docs/api.md)
- [设计原则](./docs/principles.md)
- [路线图](./docs/roadmap.md)

## 示例

所有示例在 [examples/](./examples) 目录，无需额外配置即可运行：

```bash
# 快速体验
npx tsx examples/hello.ts

# PR 自动审查（杀手级示例）
GITHUB_TOKEN=xxx npx tsx examples/pr-reviewer.ts https://github.com/facebook/react/pull/32123

# 本地代码审查
npx tsx examples/code-reviewer.ts

# 更多示例见 [examples/README.md](https://github.com/exposir/Dao/blob/main/examples/README.md)
```
