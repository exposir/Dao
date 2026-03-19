# Dao 开发路线图

## 里程碑总览

```
V0.1 核心可用        V0.5 流程控制        V1.0 完整能力
────────────────    ────────────────    ────────────────
bot.chat("你好")    steps 引擎          team() 多 Agent
能跑通              能跑通              能跑通
```

---

## V0.1 — 核心可用

> 目标：`agent()` + `tool()` + Agent Loop + 模型层 + 基础 memory，能跑通 `bot.chat("你好")`

### 第 1 步：类型定义

| 文件 | 内容 |
|---|---|
| `src/types.ts` | AgentOptions, ToolOptions, ToolInstance, ParamsDef, ParamSpec, RunResult, RunEvent, StepContext, HookContext, PluginOptions 等全部类型 |

### 第 2 步：工具系统

| 文件 | 内容 |
|---|---|
| `src/tool.ts` | `tool()` 函数：接收 ToolOptions，paramsToJsonSchema 转换，返回 ToolInstance |

验证：`tool({ name, description, params, run })` 能正确生成 JSON Schema。

### 第 3 步：模型层

| 文件 | 内容 |
|---|---|
| `src/model.ts` | resolveModel()：解析 `"provider/model"` 字符串，读取环境变量，创建模型实例 |

验证：`resolveModel("deepseek/deepseek-chat")` 返回可用的 LanguageModel。

### 第 4 步：Agent Loop

| 文件 | 内容 |
|---|---|
| `src/loop.ts` | 核心 while 循环：组装 messages → 调用模型 → 处理响应（文本/工具调用）→ 检查终止条件 → Grace Period |

验证：能和模型对话，能调用工具，能在 maxTurns 时停止。

### 第 5 步：agent() 入口

| 文件 | 内容 |
|---|---|
| `src/agent.ts` | `agent()` 函数：接收 AgentOptions，组装 system prompt，创建 AgentInstance（chat / run / chatStream / runStream / clearMemory） |

验证：完整跑通以下代码：

```typescript
import { agent, tool } from "dao"

const readFile = tool({
  name: "readFile",
  description: "读取文件",
  params: { path: "文件路径" },
  run: ({ path }) => fs.readFileSync(path, "utf-8"),
})

const bot = agent({
  role: "文件助手",
  model: "deepseek/deepseek-chat",
  tools: [readFile],
})

await bot.chat("读一下 package.json 的内容")
```

### 第 6 步：索引 + 构建

| 文件 | 内容 |
|---|---|
| `src/index.ts` | 导出 agent, tool, configure, registerProvider |
| `tsconfig.json` | TypeScript 配置 |
| `package.json` | 补充 dependency（`ai`）+ peerDependencies（`@ai-sdk/deepseek` 等，用户按需安装） |

### V0.1 依赖

| 包名 | 类型 | 用途 |
|---|---|---|
| `ai` | dependency | Vercel AI SDK 核心（generateText, streamText） |
| `@ai-sdk/deepseek` | peerDependency | DeepSeek 模型 |
| `@ai-sdk/openai` | peerDependency | OpenAI + OpenAI 兼容 |
| `@ai-sdk/google` | peerDependency | Gemini |
| `@ai-sdk/anthropic` | peerDependency | Claude |
| `@ai-sdk/moonshotai` | peerDependency | 月之暗面 Kimi |
| `@ai-sdk/alibaba` | peerDependency | 通义千问 Qwen |
| `@ai-sdk/zhipu` | peerDependency | 智谱 GLM |
| `typescript` | devDependency | 类型检查 |
| `tsup` | devDependency | 打包构建 |
| `vitest` | devDependency | 单元测试 |
| `dotenv` | devDependency | 加载 .env 文件 |

> **peerDependency 说明**：`ai` 是核心接口，必装。7 个 `@ai-sdk/*` 是模型 provider，用户**只需安装自己用的那个**，例如只用 DeepSeek 就只装 `@ai-sdk/deepseek`。

### V0.1 交付物

- [ ] `bot.chat("你好")` 能收到模型回复
- [ ] `bot.chat("读一下 package.json")` 能调用工具并返回结果
- [ ] `memory: true` 时多轮对话保持上下文
- [ ] `bot.run("任务")` 能自主循环直到完成或 maxTurns
- [ ] stream 模式能逐字输出

---

## V0.5 — 流程控制

> 目标：steps 引擎 + rules + 上下文压缩，能跑通步骤流程

### 第 7 步：Rules 系统

| 文件 | 内容 |
|---|---|
| `src/rules.ts` | 将 rules.focus / rules.reject 注入到 system prompt |

### 第 8 步：Steps 引擎

| 文件 | 内容 |
|---|---|
| `src/engine.ts` | 步骤执行器：字符串步骤、parallel（Promise.allSettled）、if/then/else（LLM 判断 + 函数判断）、retry、函数步骤 |

### 第 9 步：wait + resume

| 文件 | 内容 |
|---|---|
| `src/engine.ts` | WaitStep：状态序列化 + SuspendEvent + resume() |
| `src/agent.ts` | AgentInstance 添加 resume() 方法 |

### V0.5 依赖

无新增 npm 包。V0.5 全部是框架内部逻辑（rules 注入、steps 引擎、上下文压缩），基于 V0.1 已安装的 `ai` SDK 实现。

### V0.5 交付物

- [ ] 步骤列表能按顺序执行
- [ ] parallel 能并行执行
- [ ] if/then/else 能根据条件分支
- [ ] retry 能重试失败步骤
- [ ] rules.reject 能通过 prompt 约束 LLM 的行为
- [ ] wait 能暂停并恢复

---

## V1.0 — 完整能力

> 目标：team() + plugins，完整框架

### 第 10 步：插件系统

| 文件 | 内容 |
|---|---|
| `src/plugin.ts` | plugin() 函数、hook 注册和执行、全局插件 |
| `plugins/logger.ts` | 内置 logger 插件 |

### 第 11 步：team() 系统

| 文件 | 内容 |
|---|---|
| `src/team.ts` | team() 函数、auto lead 生成、delegate 工具注入 |

### 第 12 步：内置工具

| 文件 | 内容 |
|---|---|
| `tools/fs.ts` | readFile, writeFile, listDir |
| `tools/shell.ts` | runCommand, search |

### V1.0 依赖

无新增 npm 包。team()、plugin()、内置工具均为框架内部实现，不引入新依赖。内置工具使用 Node.js 标准库（`fs`、`child_process`）。

### V1.0 交付物

- [ ] 插件 hooks 正常触发
- [ ] team() 能调度多个 Agent
- [ ] 内置工具可用
- [ ] 完整文档（中文 + 英文）

---

## 未来版本 — 企业级能力

> API 已预留扩展点（见 `AgentOptions` 和 `ConfigOptions` 中的预留字段），以下能力按需实现。

### 可观测性（Observability）

- `ConfigOptions.telemetry`：tracing 链路追踪、token 用量统计
- 自定义数据导出（OpenTelemetry 兼容）

### 容错与自愈（Resilience）

- `ConfigOptions.retry`：模型调用自动重试 + 指数退避
- `AgentOptions.fallbackModel`：主模型失败自动切换备用

### 上下文管理（Context Management）

- `AgentOptions.contextWindow`：token 计数 + 自动截断/摘要
- 可能引入依赖：`tiktoken`（token 计数库）

### 安全边界（Safety Boundary）

- `ConfigOptions.maxCostPerRun`：成本上限
- 工具黑白名单（通过 `beforeToolCall` + `skip()` 插件实现）

### 可测试性（Testability）

- `AgentOptions.modelProvider`：注入 mock 模型
- 模型响应录制/回放

### 确认机制扩展（Confirm Extensibility）

- `AgentOptions.onConfirm`：自定义确认回调
- 支持 WebSocket、HTTP 回调等后端确认方式

### MCP 协议支持

- 作为 MCP Client 接入社区工具生态
- `tools: [mcp("github"), mcp("filesystem")]`

### RAG（检索增强生成）

- 不内置 RAG 模块，通过 `tool()` 接入向量数据库 API（Pinecone / Milvus / Weaviate 等）
- MCP 支持后可直接挂载社区 RAG 服务：`tools: [mcp("rag-server")]`

---

## 开发顺序

```
types.ts → tool.ts → model.ts → loop.ts → agent.ts → index.ts
   1          2          3          4          5          6
                        V0.1
                    ─────────────────

rules.ts → engine.ts → wait/resume
   7          8            9
              V0.5
          ─────────────

plugin.ts → team.ts → tools/
   10         11        12
              V1.0
          ─────────────
```

依赖关系：每一步只依赖前面的步骤，不存在循环依赖。
