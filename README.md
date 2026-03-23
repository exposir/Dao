[English](./README.en.md) | 中文

<div align="center">

# Dao

**大道至简的 AI Agent 框架**

[![npm version](https://img.shields.io/npm/v/dao-ai.svg?style=flat-square&color=cb3837)](https://www.npmjs.com/package/dao-ai)
[![license](https://img.shields.io/npm/l/dao-ai.svg?style=flat-square&color=blue)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![test](https://img.shields.io/badge/tests-162%20passed-brightgreen?style=flat-square)](./tests)

基于 Vercel AI SDK 构建的 TypeScript AI Agent 框架。<br>
DeepSeek / Qwen / Gemini / GPT 开箱即用，中文优先，开源模型友好。

```
chat()  →  tools  →  steps  →  rules  →  memory  →  team  →  plugins
 简单 ─────────────────────────────────────────────────────────► 复杂
```

每一层只加一两行代码，复杂度线性增长，不跳跃。

</div>

---

## 为什么选 Dao？

|                  | Dao                               | LangChain.js   | Vercel AI SDK  |
| ---------------- | --------------------------------- | -------------- | -------------- |
| **上手**         | 3 行，无 Zod                      | 多层抽象 + Zod | 自行编排 + Zod |
| **多 Agent**     | 内置 `team()` + `delegates`       | 需 LangGraph   | 无             |
| **步骤引擎**     | 串行/并行/条件/等待/校验          | 需 LangGraph   | 无             |
| **生产容错**     | 重试 + 超时 + fallback + 成本上限 | 部分           | 自行实现       |
| **多模态 + MCP** | 内置                              | 额外配置       | 部分           |
| **插件 + 交互**  | 8 hook + prompt 可变 + `onAsk`    | Callbacks      | 无             |
| **共享状态**     | `state` + `workspace`             | 无             | 无             |
| **中文**         | i18n + 开源模型优先               | 英文为主       | 英文为主       |

> **定位**：LangChain 大而全，AI SDK 灵活底层，**Dao 追求开箱即用 + 渐进复杂**。

---

## 30 秒上手

**1. 最简对话** — 安装 + 3 行代码，直接和模型对话：

```bash
npm install dao-ai
```

```typescript
import { agent } from "dao-ai";

const bot = agent({ model: "deepseek/deepseek-chat" });
const answer = await bot.chat("你好");
```

**2. 加工具** — 给 Agent 能力，让它能读文件、执行命令：

```typescript
const auditor = agent({
  goal: "找出代码中的 bug",
  tools: [readFile, listDir],
});
const result = await auditor.run("审查 src/ 目录");
```

**3. 加步骤** — 定义执行流程，支持串行、并行、条件分支：

```typescript
const reviewer = agent({
  role: "代码审查员",
  tools: [readFile, listDir],
  steps: [
    "了解项目结构",
    { parallel: ["分析前端代码", "分析后端代码"] },
    "生成审查报告",
  ],
});
```

**4. 完整功能** — 团队协作 + 规则约束 + 插件 + 容错，按需叠加：

```typescript
import { agent, team, plugin } from "dao-ai";

const squad = team({
  members: {
    researcher: agent({ role: "研究员", tools: [search] }),
    writer: agent({
      role: "作家",
      rules: { reject: ["不要编造数据"] },
      memory: true,
      fallbackModel: "openai/gpt-4o",
      maxCostPerRun: 100000,
    }),
  },
  plugins: [logger()],
});
await squad.run("写一篇关于 AI Agent 的深度报告");
```

---

## 核心能力

<details>
<summary><b>🖼️ 多模态 + MCP</b></summary>

```typescript
// 图片 + 文本
await bot.chat([
  { type: "text", text: "这张图片里有什么？" },
  { type: "image", image: "https://example.com/photo.jpg" },
]);

// 一行接入 MCP server
const tools = await mcpTools({ url: "http://localhost:3100/sse" });
const bot = agent({ tools });
```

</details>

<details>
<summary><b>💬 运行中提问 + 共享状态</b></summary>

```typescript
// Agent 运行中主动暂停向用户提问
const bot = agent({
  role: "代码审查员",
  tools: [readFile],
  onAsk: async (question) => await readline.question(question),
});

// 多次 run 之间共享状态
bot.state.set("todos", []);
await bot.run("第一个任务");
```

</details>

<details>
<summary><b>🔌 插件系统</b></summary>

```typescript
import { plugin } from "dao-ai";

// 8 个生命周期 hook，V2.5 支持修改 prompt 和消息
const injector = plugin({
  name: "rag-injector",
  hooks: {
    beforeModelCall: async (ctx) => {
      const docs = await vectorDb.search(ctx.prompt);
      ctx.systemPrompt += `\n\n参考资料：\n${docs.join("\n")}`;
    },
  },
});
```

</details>

<details>
<summary><b>🌐 国际化 + 可观测</b></summary>

```typescript
import { setLocale, configure, telemetryPlugin } from "dao-ai";

setLocale("en"); // 内置错误信息切换为英文

configure({
  globalPlugins: [
    telemetryPlugin({ serviceName: "my-app", recordContent: true }),
  ],
});
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
| **V2.5** | Plugin 可变性 + workspace + ask + state                    |  ✅  |

[完整路线图 →](./docs/roadmap.md)

## 文档

[完整文档 →](./docs/index.md) · [API 参考 →](./docs/api.md) · [设计原则 →](./docs/principles.md)

## License

MIT
