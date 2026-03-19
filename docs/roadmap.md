# Dao 开发路线图

## 里程碑总览

```
V0.1 核心可用  →  V0.5 流程控制  →  V1.0 完整能力  →  V1.1 生产可用  →  V2.0 企业级
──────────     ──────────     ──────────     ──────────     ────────
"chat 能跑"     "steps 能跑"     "team 能跑"     "摸了不爆"    "规模化"
✅ 完成          ✅ 完成          ✅ 完成
```

### 版本哲学

| 版本 | 主题 | 核心问题 |
|---|---|---|
| V0.1–V1.0 | **功能完整性** | 能不能跑？ |
| V1.1 | **生产可靠性** | 摸了会不会爆？ |
| V2.0 | **企业级能力** | 能不能规模化部署？ |

V1.0 → V1.1 是从“能用”到“可用”的跳跃。没有重试和超时，生产环境一天挂十几次。
V2.0 是从“可用”到“好用”，解决规模化后的成本、可观测、可测试问题。

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
import { agent, tool } from "dao-ai"

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

- [x] `bot.chat("你好")` 能收到模型回复
- [x] `bot.chat("读一下 package.json")` 能调用工具并返回结果
- [x] `memory: true` 时多轮对话保持上下文
- [x] `bot.run("任务")` 能自主循环直到完成或 maxTurns
- [x] stream 模式能逐字输出

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
| `src/engine.ts` | 步骤执行器：字符串步骤、parallel（Promise.allSettled）、if/then/else、retry、函数步骤 |

### 第 9 步：wait + resume

| 文件 | 内容 |
|---|---|
| `src/engine.ts` | WaitStep：状态序列化 + SuspendEvent + resume() |
| `src/agent.ts` | AgentInstance 添加 resume() 方法 |

### V0.5 依赖

无新增 npm 包。V0.5 全部是框架内部逻辑。

### V0.5 交付物

- [x] 步骤列表能按顺序执行
- [x] parallel 能并行执行
- [x] if/then/else 能根据条件分支
- [x] retry 能重试失败步骤
- [x] rules.reject 能通过 prompt 约束 LLM 行为
- [ ] wait 能暂停并恢复

---

## V1.0 — 完整能力

> 目标：team() + plugins，完整框架

### 第 10 步：插件系统

| 文件 | 内容 |
|---|---|
| `src/plugin.ts` | plugin() 函数、hook 注册和执行、内置 logger、全局插件 |

### 第 11 步：team() 系统

| 文件 | 内容 |
|---|---|
| `src/team.ts` | team() 函数、auto lead 生成、delegate 工具注入 |

### 第 12 步：内置工具

| 文件 | 内容 |
|---|---|
| `src/tools/index.ts` | readFile, writeFile, listDir, runCommand, search |

### V1.0 依赖

无新增 npm 包。内置工具使用 Node.js 标准库。

### V1.0 交付物

- [x] 插件 hooks 正常触发
- [x] team() 能调度多个 Agent
- [x] 内置工具可用
- [x] 中文文档

---

## V1.1 — 生产可用

> **主题**：让框架在生产环境不爆炸
> **核心原则**：LLM API 可靠性约 99%，调 100 次必出 1 次错。没有重试的生产服务一天挂十几次。
> **无新增依赖**：全部基于 Vercel AI SDK 已有能力实现

#### 不倒 — 重试 + 超时 + 错误分类

这三个是最小生产可用集。没有它们，框架不能用于生产。

### 第 13 步：重试与退避

| 文件 | 内容 | 为什么必须 |
|---|---|---|
| `loop.ts` / `types.ts` | 重试 + 指数退避 + 429 自动等待 | API 超时挂死是生产第一杀手 |

### 第 14 步：超时控制

| 文件 | 内容 | 为什么必须 |
|---|---|---|
| `loop.ts` / `types.ts` | AbortController 超时控制 | 模型卡住时不能永远等 |

### 第 15 步：错误分类

| 文件 | 内容 | 为什么必须 |
|---|---|---|
| `core/errors.ts` / `loop.ts` / `tool.ts` | DaoError 基类 + ModelError / ToolError / TimeoutError | 用户需要区分错误类型做不同处理 |

**验收标准**：断网 5 秒再连上，agent 能自动恢复；单次调用超时能抛 TimeoutError。

#### 不穷 — 成本安全

没有它，一个死循环就能刷爆 API 额度。

### 第 16 步：maxTokens 上限

| 文件 | 内容 | 为什么必须 |
|---|---|---|
| `loop.ts` / `types.ts` | `maxTokens` 参数传给 AI SDK | 限制单次调用消耗 |

**验收标准**：设置 `maxTokens: 1000`，模型回复不超过该限制。

### Phase 3：不堵 — 并发控制

| 步骤 | 文件 | 内容 | 为什么必须 |
|---|---|---|---|
| 17 | `engine.ts` / `types.ts` | `ParallelStep.concurrency` 限制 | 100 个并行 API 调用会触发 rate limit |

**验收标准**：`{ parallel: [100个任务], concurrency: 3 }` 同时最多 3 个在飞。

### V1.1 发版策略

- **不新增 npm 依赖**，全部动 AI SDK 已有参数
- **向后兼容**：只加可选参数，不改现有 API
- **先发 `1.1.0-beta.x`**，自己线上跑一周再发正式版

### V1.1 交付物

- [ ] 模型调用自动重试（指数退避）
- [ ] 429 rate limit 自动等待
- [ ] 单次调用超时控制
- [ ] 错误分类（ModelError / ToolError / TimeoutError）
- [ ] maxTokens 上限
- [ ] parallel 并发限制

---

## V2.0 — 企业级能力

> **主题**：让框架能规模化部署
> **核心原则**：V1.1 解决了“不挂”，V2.0 解决“知道为什么挂”和“挂了怎么办”
> **拆分为 3 个阶段递进，每个阶段可独立发版**

### 阶段1：可观测 — “知道发生了什么”

没有可观测性，生产出问题只能皈着。

| 能力 | 详情 |
|---|---|
| **结构化日志** | logger 插件支持 JSON 格式（接 ELK / Datadog） |
| **链路追踪** | `RunResult.requestId` + 插件层传透 |
| **Token 统计** | 实时统计各模型消耗，用于算成本 |
| **OpenTelemetry** | `ConfigOptions.telemetry`，导出到标准 OTel collector |

### 阶段2：容错 — “挂了自动救”

| 能力 | 详情 |
|---|---|
| **Fallback Model** | `AgentOptions.fallbackModel`，主模型失败自动切换 |
| **成本上限** | `configure({ maxCostPerRun: 1.0 })`，需内置模型价格表 |
| **上下文管理** | token 计数 + 自动截断/摘要，可能引入 `tiktoken` |
| **confirm 机制** | `AgentOptions.onConfirm` 回调，`tool({ confirm: true })` 正常工作 |

### 阶段3：扩展 — “接入生态”

| 能力 | 详情 |
|---|---|
| **完整流式事件** | RunEvent 新增 step_start/step_end/error/tool_call；TeamRunEvent 新增 delegate/member_start/member_end；runLoopStream 接入 PluginManager |
| **MCP 协议** | 作为 MCP Client 接入社区工具生态：`tools: [mcp("github")]` |
| **可测试性** | `AgentOptions.modelProvider` 注入 mock 模型，模型响应录制/回放，中间步骤断言 |
| **RAG** | 不内置，通过 `tool()` 接入向量数据库（Pinecone / Milvus），MCP 支持后可挂载社区 RAG 服务 |

### V2.0 发版策略

- **按阶段发 minor**：`2.0`（可观测）→ `2.1`（容错）→ `2.2`（扩展）
- **可能新增依赖**：`tiktoken`（上下文管理）、`@modelcontextprotocol/sdk`（MCP）
- **每个阶段可独立发版**，不用等全部做完

### V2.0 交付物

- [ ] 可观测性（结构化日志 + OTel + 链路追踪）
- [ ] Fallback 模型
- [ ] 成本上限
- [ ] 上下文窗口管理
- [ ] confirm 机制实现
- [ ] 完整流式事件
- [ ] 可测试性（mock + 录制回放）
- [ ] MCP 协议支持

---

## 开发节奏

```
═══ 已完成 ══════════════════════════════════════════════

V0.1  types → tool → model → loop → agent → index        ✅
V0.5  rules → engine → (wait/resume 未完成)                 ✅
V1.0  plugin → team → tools                                ✅

═══ 下一步 ══════════════════════════════════════════════

V1.1  不倒：retry → timeout → errors
      不穷：maxTokens
      不堵：concurrency

═══ 将来 ══════════════════════════════════════════════

V2.0  可观测 → 容错 → 扩展（分 3 个 minor 发版）
```

依赖关系：每一步只依赖前面的步骤，不存在循环依赖。

