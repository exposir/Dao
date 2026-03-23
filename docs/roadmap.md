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
- [x] 内置工具可用（readFile / writeFile / listDir / runCommand / search）
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

> **RAG**：不内置，通过 `tool()` 接入向量数据库，MCP 支持后可挂载社区 RAG 服务。

## V2.5 ✅ 插件深水区

> Plugin 深度介入 + 共享状态

- [x] **Plugin 可变性**：`beforeModelCall` 的 HookContext 暴露 `systemPrompt` / `messages` 的可写引用，允许插件修改 system prompt、注入/替换/压缩消息
- [x] **StepContext.workspace**：`StepContext` 增加 `workspace: Map<string, any>`，步骤间通过 key-value 共享结构化数据
- [x] **Mid-run Clarification**：Agent Loop 内置 `ask` 工具，运行中可主动暂停向用户提问
- [x] **Agent 共享状态**：`AgentInstance` 增加 `state: Map<string, any>` 可读写的运行时状态

## V3.0 ⏸️ 暂缓

> 以下功能经评估后暂缓，待真实用户需求驱动再决定：

- `resume()` per-run token — 仅高并发服务端场景需要，大多数用法是顺序调用
- Team per-run 状态隔离 — 同上，顺序调用不需要
- 动态工具加载 — 可通过重新创建 agent 实例解决，不是刚需

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
- **`contextWindow.maxMessages` 是消息数滑窗** — 不是按 token 截断，也没有自动摘要策略；token 级裁剪可通过 V2.5 plugin 可变性（`beforeModelCall` 修改 `messages`）自行实现
- **`maxCostPerRun` 是 token 总量上限** — 不是按真实模型价格计费，不包含 provider 级成本估算；如需真实计费可通过 plugin `afterModelCall` 自行统计
- **`runStream() + steps` 是步骤级流式** — 能实时看到 `step_start/step_end`，但单步内部的模型输出仍为缓冲式；真逐 token 流式需重构 engine 与 loop 的交互方式

