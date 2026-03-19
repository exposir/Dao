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

## V1.1 🚧 生产可用

> 重试 + 超时 + 错误分类 + 成本安全 + 并发控制

- [ ] 模型调用自动重试（指数退避 + 429 自动等待）
- [ ] 超时控制（`timeout` 参数 + AbortController）
- [ ] 错误分类（ModelError / ToolError / TimeoutError）
- [ ] `maxTokens` 上限
- [ ] `parallel` 并发限制（`concurrency` 参数）

## V2.0 📋 企业级

> 可观测 + 容错 + 生态，按组递进，每组可独立发版

- [ ] 结构化日志 + 链路追踪（`RunResult.requestId`）
- [ ] OpenTelemetry 集成
- [ ] Fallback Model（主模型失败自动切换）
- [ ] 成本上限（`maxCostPerRun`）
- [ ] 上下文窗口管理（token 计数 + 自动截断/摘要）
- [ ] `confirm` 机制（`onConfirm` 回调）
- [ ] 完整流式事件（step_start / step_end / tool_call / delegate）
- [ ] 可测试性（mock 模型注入 + 响应录制/回放）
- [ ] MCP 协议支持

> **RAG**：不内置，通过 `tool()` 接入向量数据库，MCP 支持后可挂载社区 RAG 服务。
