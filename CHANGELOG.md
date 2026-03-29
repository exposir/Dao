# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.5.1] — 2026-03-29

### Added

- **新增内置工具**：`deleteFile`（文件删除，`confirm: true`）和 `fetchUrl`（HTTP GET），共 7 个内置工具可用
- **新增生产级示例**（`examples/`）：
  - `retry-tool.ts` — 工具级重试（指数退避包装器 + plugin hook 方案对比）
  - `batch.ts` — 并发限制 + 失败重试轮次，适合批处理流水线
  - `persistence.ts` — state 持久化（零依赖文件存储 / 可选 Redis）
  - `pr-reviewer.ts` — 杀手级 PR 自动审查示例，输入任意 GitHub PR URL 生成结构化审查意见
- **文档**：
  - 新增 `docs/guide/plugins.md`「实用插件示例」章节，含重试、批量、持久化、RAG 完整代码片段
  - 新增 `docs/roadmap.md`「已知缺口」表格，诚实列出框架不内置但有绕行方案的 5 个场景
  - `docs/index.md` 新增「示例一览」表格，首页直接展示 6 个代表性示例
  - 首页对比表格补全 MCP 协议标注（V2.4 内置）
  - `docs/guide/team.md` 补充 `search` 工具 import

### Fixed

- **core**: 修复结构化输出回退时的异常处理逻辑（`v2.5.1` 版本回退 bug）
- **docs**: 修复多处文档与代码不一致问题（README fetchFileDiff 悬空引用、首页 features 8→10 hook、team.md 未定义 search 变量、对比表格 MCP 行矛盾）
- **meta**: 版权年份更新至 2025-2026

---

## [2.5.0] — 2025-06-??

> V2.5 Plugin 深度介入 + 共享状态

### Added

- **Plugin 可变性**：`beforeModelCall` 的 HookContext 暴露 `systemPrompt` / `messages` 可写引用
- **StepContext.workspace**：`workspace: Map<string, any>`，步骤间通过 key-value 共享结构化数据
- **Mid-run Clarification**：Agent Loop 内置 `ask` 工具，运行中可主动暂停向用户提问
- **Agent 共享状态**：`AgentInstance` 增加 `state: Map<string, any>` 可读写运行时状态
- **示例生态**：提供 PR 自动审查、本地代码审查等可运行示例
- **中文首页**：完整双语首页（中文 + English）
- **文档站**：VitePress 文档站，完整 API 文档、设计文档、指南
