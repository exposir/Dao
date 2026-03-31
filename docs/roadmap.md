# Roadmap

## V0.1 ✅ 核心可用

> `agent()` + `tool()` + Agent Loop + 模型层 + 基础 memory

- [x] `bot.chat("你好")` 能收到模型回复
- [x] `bot.chat("读一下 package.json")` 能调用工具并返回结果
- [x] `memory: true` 时多轮对话保持上下文
- [x] `bot.run("任务")` 能自主循环直到完成或 maxTurns
- [x] stream 模式能逐字输出

## V0.5 ✅ 流程控制

> steps 引擎 + rules 约束

- [x] 步骤列表按顺序执行
- [x] `parallel` 并行执行
- [x] `if/then/else` 条件分支
- [x] `retry` 重试失败步骤
- [x] `rules.reject` 通过 prompt 约束 LLM 行为
- [x] `wait` 暂停并恢复

## V1.0 ✅ 完整能力

> team() 多 Agent + 插件系统 + 内置工具

- [x] 插件 hooks 正常触发
- [x] `team()` 能调度多个 Agent
- [x] 内置工具可用（readFile / writeFile / deleteFile / listDir / runCommand / search / fetchUrl）
- [x] 中文文档

## V1.1 ✅ 不挂

> 重试 + 超时 + 错误分类 + 成本安全 + 并发控制

- [x] 模型调用自动重试（指数退避 + 429 自动等待）
- [x] 超时控制（`timeout` 参数 + AbortController）
- [x] 错误分类（ModelError / ToolError / TimeoutError）
- [x] `maxTokens` 上限
- [x] `parallel` 并发限制（`concurrency` 参数）

## V1.2 ✅ 更好用

> prompt 增强 + 输出校验

- [x] `goal` + `background` 字段（简单模式 prompt 拼接，`systemPrompt` 为专家覆盖）
- [x] 步骤输出预期（`expected_output`，拼入 prompt 引导 LLM 输出格式）
- [x] 步骤输出校验（`guardrail`，代码级 validate + 校验失败自动重试）

## V2.0 ✅ 能力补全

> confirm + 完整流式事件 + fallback + 委派，无新依赖

- [x] `confirm` 机制（工具执行前 `onConfirm` 回调确认）
- [x] 完整流式事件（step_start / step_end / tool_call / delegate）
- [x] Fallback Model（主模型失败自动切换备用模型）
- [x] Agent 级委派（`delegates` 参数，无需 team 即可跨 agent 协作）

## V2.1 ✅ 契约审计

> 代码/文档/类型全面对齐 + 测试覆盖

- [x] 5 轮深度审计，修复 13 个 bug（timer 悬挂、Promise.allSettled、流式 usage、lastResult 注入等）
- [x] 8 个文档文件与代码实现完全对齐
- [x] 测试从 48 增长到 65（含 8 个端到端 smoke test）
- [x] `npm run typecheck` 覆盖 tests/

## V2.2 ✅ 实用增强

> 结构化输出 + 可测试性 + 事件

- [x] **Agent Hook / Events**：类似 `bot.on('tool_start')` 暴露内部状态 (通过插件系统实现)
- [x] **结构化输出**：支持限制输出格式（如强制 JSON 与 Schema 校验）
- [x] **测试支持**：提供专用的 mock adapter 方便给 Agent 编写单元测试


## V2.3 ✅ 生产就绪

> 上下文管理 + 流式 steps + 成本控制

- [x] 上下文窗口管理（`contextWindow.maxMessages` 滑动窗口裁剪，防止 `memory: true` 长对话爆 token）
- [x] 流式 steps（`runStepsStream()` 按步骤逐个输出事件，单步内仍为缓冲式执行）
- [x] 成本上限（`maxCostPerRun` token 总量上限，超限抛 `CostLimitError`）

## V2.4 ✅ 生态扩展

> 多模态 + MCP + 可观测

- [x] 多模态输入（`MessageInput` 支持 text/image/file 混合内容）
- [x] MCP 协议支持（`mcpTools()` / `mcpClient()` 桥接 MCP server）
- [x] 结构化日志 + 链路追踪（`RunResult.requestId` UUID）
- [x] OpenTelemetry 集成（`telemetryPlugin()` 可选依赖）
- [x] 国际化（`setLocale("en")` / `t(key)` 中英文切换）

> ✅ **RAG**：不内置，通过 `tool()` 接入向量数据库，MCP 支持后可挂载社区 RAG 服务。

## V2.5 ✅ 插件深水区

> Plugin 深度介入 + 共享状态

- [x] **Plugin 可变性**：`beforeModelCall` 的 HookContext 暴露 `systemPrompt` / `messages` 的可写引用，允许插件修改 system prompt、注入/替换/压缩消息
- [x] **StepContext.workspace**：`StepContext` 增加 `workspace: Map<string, any>`，步骤间通过 key-value 共享结构化数据
- [x] **Mid-run Clarification**：Agent Loop 内置 `ask` 工具，运行中可主动暂停向用户提问
- [x] **Agent 共享状态**：`AgentInstance` 增加 `state: Map<string, any>` 可读写的运行时状态
- [x] **示例生态**：`pr-reviewer`（GitHub PR 自动审查）、`code-reviewer`（本地代码审查）、`translator`、`persistence` 等 8 个核心可运行示例，覆盖常用场景

## V2.6 ✅ 完善文档与生态

> 2.5.1 发版后优先级：补全已有能力的使用文档，扩充 examples 覆盖常见场景

- [x] **Retry + Timeout 文档**（`docs/guide/retry-and-timeout.md`）
- [x] **Streaming Events 完整示例**（`examples/streaming-sse.ts`，SSE 实时事件流）
- [x] **Fastify 服务端接入示例**（`examples/server.ts`，REST + SSE 双接口）
- [x] **`contextWindow` token 级滑窗**（`contextWindow.maxTokens`，字符/2 估算）

## V2.6.1 ✅ 示例生态扩充

> 13+ 可运行示例，覆盖代码生成、测试、翻译、数据库查询等实用场景

- [x] **pr-reviewer**（`examples/pr-reviewer.ts`）— GitHub PR 自动审查，fetchPRDetails / fetchFileDiff 工具，支持私有仓库
- [x] **code-reviewer**（`examples/code-reviewer.ts`）— 本地代码审查，支持增量/全量模式
- [x] **code-generator**（`examples/code-generator.ts`）— 自然语言代码生成，listSrc / writeCode / checkSyntax 工具
- [x] **auto-test**（`examples/auto-test.ts`）— AI 自动化测试生成（Vitest），支持递归、dry-run、自动运行测试
- [x] **db-query**（`examples/db-query.ts`）— 自然语言 SQL 查询，内置 SQLite 内存数据库演示
- [x] **translator**（`examples/translator.ts`）— 多语言翻译，memory 多轮 + 单次 + batch 模式
- [x] **generate**（`examples/generate.ts`）— `generate()` 结构化输出完整演示，支持 CLI 参数（`--extract` / `--classify` / `--code-review`）
- [x] **i18n**（`examples/i18n.ts`）— 框架国际化能力演示（`setLocale` / `t()` / `getLocale()` + 框架错误信息中英文）

## V2.6.2 ✅ CLI 脚手架

> `create-dao-app`，一行命令创建基于 Dao 的 AI 助手项目

- [x] **npm 包发布** — `npm install -g create-dao-app` 或 `npx create-dao-app`
- [x] **交互式创建** — 问答式配置（项目名、角色、目标、模型、工具），无需记忆参数
- [x] **零依赖 CLI** — 纯 Node.js 内置模块，无外部依赖
- [x] **渐进式模板** — 生成的代码展示 `chat()` → `tools` → `rules` → `memory` → `team()` 的演进路径
- [x] **美观 REPL** — 纯 ANSI 颜色化输出，内置命令（`exit` / `clear` / `token` / `reset`）
- [x] **命令行参数** — `--name` / `--role` / `--goal` / `--model` / `--tools` / `--no-install` 非交互模式

## V2.6.3 ✅ 新增 API

> `generate()` + `mockModel()` + `team.getMembers()` + strategy `auto`

- [x] **`generate()`** — 结构化输出完整方法，支持 JSON Schema 约束，4 个完整演示场景（信息提取、情感分类、代码审查评分、API 参数生成）
- [x] **`mockModel()`**（`src/mock.ts`）— 测试辅助，创建模拟模型，支持循环/非循环模式，完全兼容 AI SDK v3 协议
- [x] **`team.getMembers()`** — 运行时获取团队成员及其配置信息
- [x] **team `strategy: "auto"`** — 自动判断使用顺序委派或并行委派

## V2.6.4 ✅ 新增内置能力

> V2.5 遗漏或新增的内置能力补充文档

- [x] **`agent.state: Map<string, any>`** — 跨 run 共享运行时状态，`examples/v25-features.ts` 完整演示
- [x] **`onAsk`** — Agent 运行中主动向用户提问，`examples/v25-features.ts` 演示
- [x] **`telemetryPlugin()`**（`src/telemetry.ts`）— OpenTelemetry 集成插件，支持 input / model_call / model_response / complete / error 全链路 span
- [x] **`HookContext.systemPrompt` / `HookContext.messages` 可写引用** — Plugin 可变性，`beforeModelCall` 可修改 system prompt 和消息历史
- [x] **`StepContext.workspace: Map<string, any>`** — 步骤间传递结构化数据，`examples/v25-features.ts` 演示

---

## V3.0 🚧 探索方向

> 2.5 发布后，待真实用户反馈驱动再决定优先级。以下为初步候选：

- **Agent 持久化**：序列化 `AgentInstance` 到文件/Redis，支持中断恢复（需权衡轻量定位）
- **逐 token 流式**：重构 engine 与 loop 交互，真·流式输出到单步内部
- **per-run 精确恢复**：`resume()` 从广播式改为 run 级别精确控制
- **沙箱 / 工具隔离**：安全执行不可信工具（非优先级，看用户场景）
- **DAG 流程引擎**：steps 从线性/并行升级为有向无环图，支持依赖拓扑排序
- **多租户 Agent Pool**：agent 资源池化管理，支持并发数和内存限制
- **Agent 镜像 / 版本化**：保存/回滚 agent 配置快照，支持 A/B 测试不同 prompt 版本
- **Structured Output 校验层**：将 `generate()` 的 schema 校验从 best-effort 升级为强保证（失败自动重试 + maxAttempts）
- **MCP 原生集成**：不只是桥接 MCP tools，还支持 MCP resources / prompts / sampling

|

## ⚠️ 已知缺口（可通过 Plugin 绕行）

> 以下需求框架不内置，但都可以通过 plugin / 示例代码解决：

| 缺口 | 原因 | 绕行方案 |
|------|------|---------|
| **无工具级 retry** | 大多数工具不需要，框架不预设成本 | 包装工具：`withRetry(tool)` 示例见 `examples/retry-tool.ts` |
| **无状态持久化** | 轻量定位，持久化方式因场景差异大 | `examples/persistence.ts` 提供文件 / Redis 两种方案 |
| **无批量任务工具** | 循环 + 并发是语言基础能力 | `examples/batch.ts` 提供带重试的并发批量示例 |
| **无 token 级流式** | 单步内缓冲式执行是设计取舍 | V2.5 步骤级流式已可用（`runStream()`），真逐 token 流式属 V3.x 范畴 |
| **无自动测试生成** | 不内置，端到端测试场景差异大 | `examples/auto-test.ts` 提供基于 Vitest 的 AI 测试生成方案 |
| **无自然语言 SQL 查询** | 数据库类型多样，不预设连接方式 | `examples/db-query.ts` 提供 SQLite 内存数据库 + 自然语言查询完整方案 |
| **无 PR 自动审查** | 需要 GitHub API 集成，不适合框架内置 | `examples/pr-reviewer.ts` 提供完整 GitHub PR 审查方案 |

---

## 🚫 明确不做

> 以下功能超出「大道至简」定位，不纳入框架核心：

- **RAG** — 通过 `tool()` 接入向量数据库即可，不内置检索增强
- **Agent 通信协议** — `team()` + `delegates` 已满足多 Agent 协作，不引入额外协议层
- **沙箱 / 安全隔离** — 工具执行沙箱化过于重量级，安全由使用者自行控制
- **长时运行 / 状态持久化** — 跑数小时、断点恢复、checkpoint 等机制过重，不符合轻量定位（含 Agent 持久化 save/load）
- **上下文自动摘要** — 需要额外模型调用，增加成本和延迟，用户更需要自主控制（可通过 V2.5 plugin 可变性自行实现）
- **响应缓存** — 开发工具，不是框架核心能力，可通过 plugin 实现
- **步骤级重试** — V0.5 已支持 steps `retry`，无需重复

## ✅ 设计决策（By Design）

> 以下行为是有意的工程取舍，不是 bug：

- **`team({ lead })` 重建 lead** — lead 需要注入 delegate 工具，而工具列表是 agent 创建时固定的，复用原实例需要动态注入，引入更多复杂度
- **`getConfig()` 非完整深拷贝** — tools/plugins 含函数引用和闭包状态，`structuredClone` 无法处理；顶层副本 + rules/steps 数组复制已覆盖 99% 误操作
- **`resume()` 广播式恢复** — 同一 agent 多个 `wait` 挂起时，`resume()` 会全部恢复。per-run 精确恢复属于 V3.0 范畴
- **`contextWindow.maxMessages` 是消息数滑窗** — 另有 `maxTokens` 按 token 数滑动窗口，字符数/2 估算
- **`maxCostPerRun` 是 token 总量上限** — 不是按真实模型价格计费，不包含 provider 级成本估算；如需真实计费可通过 plugin `afterModelCall` 自行统计
- **`runStream() + steps` 是步骤级流式** — 能实时看到 `step_start/step_end`，但单步内部的模型输出仍为缓冲式；真逐 token 流式需重构 engine 与 loop 的交互方式

