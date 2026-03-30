# Examples

每个文件都是一个独立可运行的示例。运行前确保已安装依赖并配置好 `.env`。

## 安装

```bash
npm install
cp .env.example .env   # 填入你的 API Key
```

## 示例列表

### [pr-reviewer.ts](pr-reviewer.ts) — PR 自动审查 ⭐

**杀手级示例。** 输入任意 GitHub PR URL，自动获取 diff 并生成结构化审查意见。

```bash
npx tsx examples/pr-reviewer.ts https://github.com/facebook/react/pull/32123
```

适合：Code Review 自动化、PR 机器人、Code Quality 流水线。

---

### [hello.ts](hello.ts) — 3 行跑通

最简示例，3 行代码创建一个 Agent 并对话。

```bash
npx tsx examples/hello.ts
```

### [multi-tool.ts](multi-tool.ts) — 带工具的 Agent

给 Agent 添加读文件、执行命令等工具能力。

```bash
npx tsx examples/multi-tool.ts
```

### [code-reviewer.ts](code-reviewer.ts) — 本地代码审查

基于本地文件系统的代码审查，不依赖 GitHub API。

```bash
npx tsx examples/code-reviewer.ts
```

### [translator.ts](translator.ts) — 多语言翻译

展示如何用 Agent 做批量翻译任务，支持多轮记忆保持上下文风格。

```bash
npx tsx examples/translator.ts
```

---

### [multimodal.ts](multimodal.ts) — 多模态输入

支持图片 + 文本 + PDF 文件的混合输入，基于 Gemini 模型。

```bash
npx tsx examples/multimodal.ts
```

---

### [mcp-tools.ts](mcp-tools.ts) — MCP 协议集成

通过 MCP（Model Context Protocol）桥接外部工具服务。

> 需要先启动 MCP server（如 `npx @modelcontextprotocol/server-filesystem`），默认连接 `http://localhost:3100/sse`。

```bash
npx tsx examples/mcp-tools.ts
```

---

### [i18n.ts](i18n.ts) — 国际化

中英文切换，`setLocale("en")` 即时生效，所有内置错误信息自动翻译。

```bash
npx tsx examples/i18n.ts
```

---

### [retry-tool.ts](retry-tool.ts) — 工具级自动重试

指数退避重试包装器，给任何工具加稳定性，不改原始代码。

```bash
npx tsx examples/retry-tool.ts
```

---

### [batch.ts](batch.ts) — 批量任务 + 失败重试

限制并发数、只重试失败项，保留成功结果，适合跑批处理流水线。

```bash
npx tsx examples/batch.ts
```

---

### [persistence.ts](persistence.ts) — 状态持久化

`state` 跨进程持久化，支持文件存储（零依赖）和 Redis 存储（分布式场景）。

```bash
npx tsx examples/persistence.ts
# 或 Redis 模式：
REDIS_URL=redis://localhost:6379 npx tsx examples/persistence.ts
```

---

### [v25-features.ts](v25-features.ts) — V2.5 新特性演示

展示 V2.5 版本新增能力的合集：workspace / state / ask / Plugin 可变性。

```bash
npx tsx examples/v25-features.ts
```

---

### [streaming-sse.ts](streaming-sse.ts) — SSE 实时事件流

通过 Server-Sent Events 实时接收 `step_start` / `text` / `step_end` / `done` 事件，服务端和客户端双端演示。

```bash
npx tsx examples/streaming-sse.ts
```

适合：终端 UI、实时日志、调试 Agent 运行过程。

---

### [server.ts](server.ts) — Fastify HTTP 服务端

将 Agent 接入 Fastify，提供 `/api/chat`（同步）和 `/api/chat/stream`（SSE）两个接口。

```bash
npm install fastify @fastify/cors
npx tsx examples/server.ts
```

适合：构建 API 服务、嵌入现有 Web 应用、部署到生产环境。

---

### [code-generator.ts](code-generator.ts) — 自然语言代码生成

输入自然语言需求，Agent 自动生成 TypeScript 代码，写入文件并验证语法。内置 `listSrc` / `writeCode` / `checkSyntax` 工具链。

```bash
npx tsx examples/code-generator.ts
# 或指定需求：
npx tsx examples/code-generator.ts "写一个函数判断字符串是否是回文"
```

适合：快速原型生成、自动化脚手架、代码补全流水线。

---

### [db-query.ts](db-query.ts) — 自然语言 SQL 查询

内置 SQLite 演示，零外部依赖。输入自然语言问题，Agent 自动生成 SQL、执行并解释结果。

> 依赖：`npm install better-sqlite3 @types/better-sqlite3`

```bash
npx tsx examples/db-query.ts
# 或指定问题：
npx tsx examples/db-query.ts "哪些用户的订单总额超过 1000？"
```

适合：数据分析助手、BI 报表生成、数据库文档生成。

---

### [auto-test.ts](auto-test.ts) — 自动化测试生成

读取源代码，分析函数逻辑，生成 Vitest 测试用例（覆盖正常路径、边界值、空输入、异常输入）。

```bash
npx tsx examples/auto-test.ts src/utils/median.ts
```

适合：测试驱动开发（TDD）、遗留代码补充测试、CI 流水线集成。
