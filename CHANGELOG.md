# Changelog

## 1.1.0 (2026-03-20)

### Features

- **retry**: 模型调用自动重试，支持指数退避 + 429 rate limit 自动等待（`agent({ retry: { maxRetries: 3 } })`）
- **timeout**: 超时控制，超时抛出 `TimeoutError`（`agent({ timeout: 30000 })`）
- **errors**: 错误分类体系 — `DaoError` 基类 + `ModelError` / `ToolError` / `TimeoutError`，支持 `instanceof` 区分
- **maxTokens**: 限制单次模型调用最大输出 token 数（`agent({ maxTokens: 1000 })`）
- **concurrency**: parallel 步骤并发控制（`{ parallel: [...], concurrency: 3 }`）

## 1.0.1 (2026-03-20)

### Bug Fixes

- **engine**: 修复字符串步骤通过 `ctx.agent.run()` 导致的无限递归，改为 `executeTask` 回调直接走 `runLoop`
- **engine**: 修复中文条件判断 `answer.includes("是")` 误匹配"不是"，改为否定词优先 + YES/NO prompt
- **engine**: `onStepEnd` 回调添加 `await`，确保 async 回调完成
- **team**: 修复 `TeamRunResult.memberResults` 始终为空，通过闭包收集 delegate 执行结果
- **team**: 修复 `maxRounds` / `plugins` 静默无效，正确传给 lead agent
- **team**: 修复 usage 只返回 lead 消耗，改为聚合 lead + 所有 member 的 token 用量
- **team**: 消除 `leadConfig` 在 lead 存在时浪费创建 Agent 实例
- **agent**: 修复 steps 模式 `usage` 始终为 `{ 0, 0, 0 }`，从 `stepUsages` 聚合
- **agent**: 修复 `stepUsages` 闭包级累积，多次 `run()` 会叠加，改为每次 `run()` 清空
- **agent**: `chatStream` 添加 try-catch + `pm.emit("onError")`
- **agent**: `runStream` 支持 steps 引擎 + PluginManager
- **agent**: `run()` / `chat()` 添加 try-catch + `pm.emit("onError")` + `pm.emit("afterStep")`
- **tools**: `search` 工具排除 `.git` / `.next` / `.cache` 目录，`skipDirs` Set 提到循环外
- **tools**: `listDir` 递归模式跳过 `node_modules` / `dist`
- **types**: `RunEvent.type` 缩减为 `"text" | "done"`，去掉未实现的 step_start / step_end / error
- **types**: `TeamRunEvent.type` 缩减为 `"text" | "done"`，去掉未实现的 delegate / member_start / member_end
- **types**: `memberResults` 类型从 `any[]` 改为 `RunResult[]`

## 1.0.0 (2026-03-19)

### Features

- **agent**: `agent()` 核心函数，支持 `chat` / `run` / `chatStream` / `runStream`
- **tool**: `tool()` 函数，声明式定义工具，自动生成 JSON Schema
- **model**: 多 provider 支持（DeepSeek / OpenAI / Google / Anthropic / Kimi / Qwen / 智谱）
- **steps**: 声明式步骤引擎（字符串步骤、parallel、if/then/else、retry、函数步骤）
- **team**: `team()` 多 Agent 协作，auto lead + delegate 工具 + memberResults 收集
- **plugin**: 插件系统，支持完整生命周期 hooks
- **rules**: `rules.focus` / `rules.reject` 约束 LLM 行为
- **tools**: 内置工具（readFile / writeFile / listDir / runCommand / search）
- **memory**: `memory: true` 多轮对话上下文保持
- **configure**: 全局配置（defaultModel / defaultPlugins / registerProvider）
