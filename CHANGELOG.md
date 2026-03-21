# Changelog

## 2.2.0 (2026-03-22)

### Features

- **core**: 支持类型安全的结构化输出：`agent.generate()` 方法，底层接入 AI SDK 的 `generateObject`。
- **core**: 新增测试辅助函数 `mockModel()`，用于创建按顺序返回预设文本或对象字符串的假模型。
- **types**: 新增 `GenerateOptions<T>` 和 `GenerateResult<T>` 以加强对参数和返回结果的类型约束。
- **infra**: AI SDK 及其各类 Provider 依赖（`ai` 和 `@ai-sdk/x`）版本前移至最新的 V2 / V3 规范。

## 2.1.0 (2026-03-21)

### Bug Fixes

- **loop**: `runLoopStream()` 成功完成时未 `clearTimeout`，导致悬挂定时器后续触发 `AbortController.abort()`
- **loop**: `afterModelCall` 三条路径（正常/fallback/流式）传参格式不统一，fallback 传纯字符串、流式传 `"(stream)"`，现统一为 `{ text, usage }` 对象
- **engine**: `executeParallel()` 使用 `Promise.all()`，任一子步骤失败导致整个 parallel step 废弃，改为 `Promise.allSettled()` + 失败步骤记录 `{ error }`
- **engine**: 字符串步骤和 TaskStep 未注入 `lastResult`，步骤间无上下文传递，现自动拼接到 prompt
- **agent**: `run()` 步骤错误兜底 — `runSteps` 循环体加 try-catch，单步失败记录错误继续下一步（AbortError 穿透）
- **agent**: `chatStream()` / `runStream()` 的 `onComplete` 传给插件的 `RunResult` 全是假值（duration=0, usage=0, output=""），现传真实数据
- **agent**: `runStream()` steps 全失败时只输出最后一步错误，现与 `run()` 对齐输出每步错误汇总
- **agent**: `globalPlugins` 仅存在于类型和文档，`agent()` 未合并全局插件，现通过 `getGlobalConfig()` 合并
- **team**: `maxRounds` 默认值只补到自动 lead 分支，自定义 lead 分支回退到 agent 默认 50，现两分支都补 `?? 20`
- **types**: `RunEvent` 的 `done` 事件 `data` 固定为 `null`，无法传出流式 usage，改为 `{ usage?: TokenUsage } | null`
- **team**: `createTeamInstance` 内部参数 `memberResults` 类型为 `any[]`，收紧为 `RunResult[]`
- **plugin**: 同名插件实例覆盖已有 store，加 `has()` 防重 + 注释说明共享行为
- **README**: `runStream()` 示例 switch 缺少 `break` 导致 fallthrough

### Features

- **engine**: Steps 引擎自动将 `lastResult` 注入到每一步的 prompt（字符串步骤和 TaskStep 均支持）
- **loop**: 流式 `done` 事件携带 `{ usage }` 数据，上层可提取真实 token 用量
- **infra**: 新增 `tsconfig.check.json` 覆盖 `tests/` 类型检查，`npm run typecheck` 同时检查源码和测试
- **tests**: 所有测试 mock 补齐 `resume()` 方法，与 `AgentInstance` 接口对齐

### Docs

- **agent-loop**: Grace Period 全部替换为 maxTurns 硬截断描述（当前使用 AI SDK `stepCountIs()` 实现）
- **engine**: Prompt 模板改为实际的 `上一步结果 + 当前步骤` 格式；错误处理表对齐实际行为
- **team**: 执行流程伪码更新为当前实现（单个 delegate 工具 + `maxRounds ?? 20`），usage 改为 lead + member 聚合
- **api**: `RunEvent` done 事件类型、`TeamRunEvent` 交叉类型、delegate 工具示例同步
- **design**: 模型层表格对齐实现（DeepSeek 用 `@ai-sdk/openai` 兼容模式、环境变量名修正）
- **plugins**: store 描述改为"按 name 索引，同名插件共享"
- **principles**: `createDelegateTools()` 引用替换为闭包封装描述
- **README**: 文档链接修复（`docs/README.md` → `docs/index.md`）

## 2.0.1 (2026-03-20)

### Features

- **wait/resume**: 暂停步骤 — `{ wait: true }` + `bot.resume(data)` 恢复执行

### Docs

- README 全面更新，补充 V1.1 ~ V2.0 所有新功能示例
- API 文档同步 V1.1 ~ V2.0 新参数（retry / timeout / maxTokens / TaskStep / WaitStep / delegates / fallback / RunEvent 等）

## 2.0.0 (2026-03-20)

### Features

- **confirm**: 工具确认机制 — `tool({ confirm: true })` + `agent({ onConfirm: async (name, params) => ... })`
- **streaming events**: 完整流式事件 — `step_start` / `step_end` / `tool_call`，通过 `runStream()` 获取
- **fallback**: 备用模型 — `agent({ fallbackModel: "openai/gpt-4o" })`，主模型失败自动切换
- **delegates**: Agent 级委派 — `agent({ delegates: { researcher, writer } })`，无需 team 即可跨 agent 协作

### Breaking Changes

- `RunEvent` 从 `interface` 改为 `type`（联合类型），新增 `step_start` / `step_end` / `tool_call` 事件类型

## 1.2.0 (2026-03-20)

### Features

- **goal**: `agent({ goal: "找出 bug" })` — 告诉 LLM 它要完成什么，拼入 system prompt
- **background**: `agent({ background: "10 年经验" })` — 告诉 LLM 它为什么能完成
- **systemPrompt 专家模式**: 提供 `systemPrompt` 时忽略 role/goal/background 自动拼接
- **expected_output**: `{ task: "分析市场", output: "500 字报告" }` — 步骤输出预期，拼入 prompt 引导格式
- **guardrail**: `{ task: "生成 JSON", validate: (r) => ..., maxRetries: 3 }` — 代码级输出校验，失败自动重试

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
