# 示例

所有示例均为独立可运行文件，放置在 `examples/` 目录。

## 运行前准备

```bash
npm install
cp .env.example .env   # 填入你的 API Key（DEEPSEEK_API_KEY 等）
```

## 快速体验

### [hello.ts](https://github.com/exposir/Dao/blob/main/examples/hello.ts) — 3 行跑通

最简示例，3 行代码创建 Agent 并对话。涵盖：纯聊天、带工具、多轮记忆、流式输出。

```bash
npx tsx examples/hello.ts
```

### [pr-reviewer.ts](https://github.com/exposir/Dao/blob/main/examples/pr-reviewer.ts) — PR 自动审查 ⭐

**杀手级示例。** 输入任意 GitHub PR URL，自动获取 diff 并生成结构化审查意见。

```bash
npx tsx examples/pr-reviewer.ts https://github.com/facebook/react/pull/32123
```

## 进阶示例

### [multi-tool.ts](https://github.com/exposir/Dao/blob/main/examples/multi-tool.ts) — 多工具协作

给 Agent 添加 readFile / writeFile / calculate 等多个工具，完成组合任务。

```bash
npx tsx examples/multi-tool.ts
```

### [code-reviewer.ts](https://github.com/exposir/Dao/blob/main/examples/code-reviewer.ts) — 本地代码审查

基于本地文件系统的代码审查，使用 rules 约束 LLM 只读不写。

```bash
npx tsx examples/code-reviewer.ts
```

### [translator.ts](https://github.com/exposir/Dao/blob/main/examples/translator.ts) — 多语言翻译

多轮记忆 + 风格保持，支持中英互译并保持原文风格。

```bash
npx tsx examples/translator.ts
```

### [v25-features.ts](https://github.com/exposir/Dao/blob/main/examples/v25-features.ts) — V2.5 新特性

展示 V2.5 版本新增能力：workspace / state / ask / Plugin 可变性。

```bash
npx tsx examples/v25-features.ts
```

## 专项示例

### [multimodal.ts](https://github.com/exposir/Dao/blob/main/examples/multimodal.ts) — 多模态输入

支持图片 + PDF 文件混合输入，基于 Gemini 模型。

```bash
npx tsx examples/multimodal.ts
```

### [mcp-tools.ts](https://github.com/exposir/Dao/blob/main/examples/mcp-tools.ts) — MCP 协议集成

通过 MCP（Model Context Protocol）桥接外部工具服务（如文件系统 MCP server）。

> 需要先启动 MCP server：`npx @modelcontextprotocol/server-filesystem`
> 默认连接 `http://localhost:3100/sse`

```bash
npx tsx examples/mcp-tools.ts
```

### [i18n.ts](https://github.com/exposir/Dao/blob/main/examples/i18n.ts) — 国际化

`setLocale("en")` 即时切换中英文，所有内置错误信息自动翻译。

```bash
npx tsx examples/i18n.ts
```
