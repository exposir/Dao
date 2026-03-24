English | [中文](./README.md)

<div align="center">

# 道 Dao

**The Simplest AI Agent Framework**

[![npm version](https://img.shields.io/npm/v/dao-ai.svg?style=flat-square&color=cb3837)](https://www.npmjs.com/package/dao-ai)
[![license](https://img.shields.io/npm/l/dao-ai.svg?style=flat-square&color=blue)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![test](https://img.shields.io/badge/tests-333%20passed-brightgreen?style=flat-square)](./tests)

A TypeScript AI Agent framework built on Vercel AI SDK.<br>
DeepSeek / Qwen / Gemini / GPT out of the box. Chinese-first, open-model friendly.

```
chat()  →  tools  →  steps  →  rules  →  memory  →  team  →  plugins
simple ─────────────────────────────────────────────────────────► complex
```

Each layer adds just 1–2 lines of code. Complexity grows linearly, never jumps.

</div>

---

## Why Dao?

| | Dao | LangChain.js | Vercel AI SDK |
|---|---|---|---|
| **Getting started** | 3 lines, no Zod | Multi-layer abstractions + Zod | DIY orchestration + Zod |
| **Multi-Agent** | Built-in `team()` + `delegates` | Requires LangGraph | None |
| **Step engine** | Sequential / parallel / conditional / wait / guardrail | Requires LangGraph | None |
| **Production resilience** | Retry + timeout + fallback + cost limit | Partial | DIY |
| **Multimodal + MCP** | Built-in | Extra config | Partial |
| **Plugins + interaction** | 8 hooks + mutable prompt + `onAsk` | Callbacks | None |
| **Shared state** | `state` + `workspace` | None | None |
| **i18n** | Built-in zh/en + open-model first | English only | English only |

> **Positioning**: LangChain is comprehensive, AI SDK is flexible & low-level, **Dao aims for out-of-the-box + progressive complexity**.

---

## Quick Start

```typescript
import { agent } from "dao-ai"

const bot = agent({ model: "deepseek/deepseek-chat" })
console.log(await bot.chat("Hello"))
```

---

## Progressive Examples

**1. Add tools** — Give your Agent capabilities:

```typescript
const auditor = agent({
  goal: "Find bugs and security issues",
  tools: [readFile, listDir],
})
const result = await auditor.run("Review the src/ directory")
```

**2. Add steps** — Define execution flow with sequential, parallel, and conditional branches:

```typescript
const reviewer = agent({
  role: "Code reviewer",
  tools: [readFile, listDir],
  steps: [
    "Understand project structure",
    { parallel: ["Review frontend code", "Review backend code"] },
    "Generate review report",
  ],
})
```

**3. Full features** — Team collaboration + rules + plugins + fault tolerance, stack as needed:

```typescript
import { agent, team, plugin } from "dao-ai"

const squad = team({
  members: {
    researcher: agent({ role: "Researcher", tools: [search] }),
    writer: agent({
      role: "Writer",
      rules: { reject: ["Do not fabricate data"] },
      memory: true,
      fallbackModel: "openai/gpt-4o",
      maxCostPerRun: 100000,
    }),
  },
  plugins: [logger()],
})
await squad.run("Write an in-depth report on AI Agents")
```

---

## Core Capabilities

<details>
<summary><b>🖼️ Multimodal + MCP</b></summary>

```typescript
// Image + text
await bot.chat([
  { type: "text", text: "What's in this image?" },
  { type: "image", image: "https://example.com/photo.jpg" },
])

// One-line MCP server integration
const tools = await mcpTools({ url: "http://localhost:3100/sse" })
const bot = agent({ tools })
```

</details>

<details>
<summary><b>💬 Mid-run Clarification + Shared State</b></summary>

```typescript
// Agent pauses mid-run to ask the user
const bot = agent({
  role: "Code reviewer",
  tools: [readFile],
  onAsk: async (question) => await readline.question(question),
})

// State shared across multiple runs
bot.state.set("todos", [])
await bot.run("First task")
```

</details>

<details>
<summary><b>🔌 Plugin System</b></summary>

```typescript
import { plugin } from "dao-ai"

// 8 lifecycle hooks, V2.5 supports mutable prompt & messages
const injector = plugin({
  name: "rag-injector",
  hooks: {
    beforeModelCall: async (ctx) => {
      const docs = await vectorDb.search(ctx.prompt)
      ctx.systemPrompt += `\n\nReference:\n${docs.join("\n")}`
    },
  },
})
```

</details>

<details>
<summary><b>🌐 i18n + Observability</b></summary>

```typescript
import { setLocale, configure, telemetryPlugin } from "dao-ai"

setLocale("en") // Switch all built-in messages to English

configure({
  globalPlugins: [
    telemetryPlugin({ serviceName: "my-app", recordContent: true }),
  ],
})
```

</details>

---

## Roadmap

| Phase | Content | Status |
|-------|---------|:------:|
| **V0.1** | agent + tool + loop + memory | ✅ |
| **V0.5** | steps + rules + parallel + if/wait | ✅ |
| **V1.x** | team + plugins + built-in tools + retry/timeout/error types + guardrail | ✅ |
| **V2.x** | confirm + streaming + fallback + delegates + structured output + mock | ✅ |
| **V2.3** | Context management + cost control | ✅ |
| **V2.4** | Multimodal + MCP + OTel + i18n | ✅ |
| **V2.5** | Plugin mutability + workspace + ask + state | ✅ |


## Documentation

- [Getting Started](./docs/guide/getting-started.md)
- [Full Documentation](./docs/index.md)
- [API Reference](./docs/api.md)
- [Design Principles](./docs/principles.md)
- [Roadmap](./docs/roadmap.md)

