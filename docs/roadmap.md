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
- [ ] `wait` 暂停并恢复

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

## V2.1 📋 可观测

> 日志 + 链路追踪 + 可测试性

- [ ] 结构化日志 + 链路追踪（`RunResult.requestId`）
- [ ] OpenTelemetry 集成（可选依赖 `@opentelemetry/api`）
- [ ] 可测试性（mock 模型注入 + 响应录制/回放）

## V2.2 📋 生态

> 上下文管理 + 成本控制 + MCP

- [ ] 上下文窗口管理（token 计数 + 自动截断/摘要）
- [ ] 成本上限（`maxCostPerRun`）
- [ ] MCP 协议支持

> **RAG**：不内置，通过 `tool()` 接入向量数据库，MCP 支持后可挂载社区 RAG 服务。
