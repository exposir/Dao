# Changelog

## 2.4.0 (2026-03-23)

### Features

- **agent**: 多模态输入 — `chat()`/`run()`/`chatStream()`/`runStream()` 支持 `MessageInput`（`string | ContentPart[]`），可传入文本、图片、文件混合内容
- **mcp**: MCP 协议支持 — `mcpTools()` / `mcpClient()` 桥接外部 MCP server 工具（`@ai-sdk/mcp` 可选依赖）
- **loop**: `RunResult.requestId` — 每次执行生成唯一 UUID，便于链路追踪
- **telemetry**: `telemetryPlugin()` — OpenTelemetry 集成插件，注入 span/trace（`@opentelemetry/api` 可选依赖）
- **i18n**: 国际化支持 — `setLocale("en")`/`t(key)` 切换中英文，覆盖所有内置字符串

### Types

- 新增：`MessageInput`、`ContentPart`、`TextPart`、`ImagePart`、`FilePart`
- `RunResult` 新增 `requestId: string` 字段
- `AgentInstance` 方法签名更新为 `MessageInput` 参数

## 2.3.0 (2026-03-23)

### Features

- **agent**: 上下文窗口管理 — `contextWindow: { maxMessages }` 滑动窗口裁剪，防止 `memory: true` 长对话无限增长
- **engine**: 流式 Steps — `runStepsStream()` async generator，`runStream()` + steps 现在逐步实时输出事件，不再缓冲
- **loop**: 成本上限 — `maxCostPerRun` 设置单次执行的 token 总量上限，超限抛 `CostLimitError`
- **errors**: 新增 `CostLimitError` 错误类型，包含 `totalTokens` 和 `limit` 字段

### Tests

- 新增 11 个测试（122 → 133）
  - `context-window.test.ts`: 6 tests（maxMessages 裁剪、默认不裁剪、memory:false 兼容、clearMemory、chatStream 裁剪、getConfig）
  - `cost-limit.test.ts`: 5 tests（超限抛错、未超限正常、未设置不检查、错误字段、run() 兼容）

## 2.2.4 (2026-03-23)

### Bug Fixes

- **engine**: ConditionalStep 字符串条件 LLM 调用失败时不再静默返回 `false`，改为上抛异常
- **engine**: `onWait` 回调在递归调用 `executeStep` 时正确传递，嵌套 `{ if: x, then: { wait: true } }` 不再崩溃
- **engine**: `ParallelStep` 中 `AbortError` 不再被 `Promise.allSettled` 降级为 `{ error }`，保持全局中断语义
- **engine**: `ParallelStep` 每个子步骤使用独立 `ctx` 浅拷贝，防止并行竞态污染 `history` 和 `lastResult`
- **engine**: 所有 `JSON.stringify(ctx.lastResult)` 改用 `safeStringify`，防止循环引用导致崩溃
- **engine**: WaitStep `Promise.race` 的 `setTimeout` 句柄在 `finally` 中清理，防止 timer 泄漏
- **engine**: 重试 prompt 注入上次实际输出，LLM 可对照错误修正而非盲目重试
- **loop**: `ctx.abort()` 在 Agent Loop 工具中通过 `AbortController` 信号中断 `generateText`/`streamText`
- **plugin**: `PluginManager.emit()` 每个 hook 包裹 `try/catch`，非 `onError` hook 报错不再炸穿核心路径
- **team**: 修正 `streamRef` 注释

### Features

- **engine**: WaitStep 新增可选 `timeout` 参数（毫秒），超时后抛出错误
- **types**: `WaitStep` 接口新增 `timeout?: number` 字段

### Tests

- 新增嵌套 wait、并行 AbortError、ctx 隔离、插件异常隔离、重试上下文注入等测试
- 测试总数从 88 增至 111 (+23)

## 2.2.3 (2026-03-23)

### Documentation

- **team.md**: 新增并发限制（§9）、自定义 lead 重建行为（§10）、流式模式数据链路（§11）三个章节
- **api.md**: `TeamInstance` 类型补充并发限制 WARNING 警告
- **engine.md**: wait/resume 补充"广播式恢复"设计限制说明，新增 runStream()+steps 缓冲式行为说明（§9）
- **principles.md**: 闭包封装模式补充 stream 分支走 `runStream()` 的描述；可测试性更新为 V2.2 ✅

### Tests

- **fallback.test.ts**: 重写，新增主模型失败抛错验证和副作用工具调用测试（6 tests）
- **abort.test.ts**: 重写，新增 AbortError 穿透验证、onError 插件交互测试、非 abort 错误触发 onError 验证（6 tests）
- **team.test.ts**: 补充 `getMembers()` 副本验证、`run()` + memberResults 结构验证（5 tests → from 3）
- **agent.test.ts**: 补充 `getConfig()` 深层拷贝测试：steps 数组、rules.focus/reject、delegates 引用（8 tests → from 5）
- 测试总数从 88 增至 99 (+11)

## 2.2.2 (2026-03-23)

### Bug Fixes

- **loop**: `ctx.abort()` 抛出的 `AbortError` 被误判为超时（与 `AbortController.abort()` 的 `AbortError` name 冲突），三个函数都增加 `instanceof AbortError` 优先穿透
- **loop**: usage 提取逻辑重复 6 处且主路径/fallback 路径格式不一致，封装 `extractUsage()` 统一兼容 v2/v3 格式
- **loop**: `runGenerate` 的 `startTime` 在 `beforeModelCall` hook 之后赋值，导致 duration 偏小
- **agent**: `chatStream()` 的 catch 缺少 `AbortError` 过滤，`ctx.abort()` 错误触发 `onError` 插件
- **agent**: `chat()` 和 `generate()` 的 catch 同样缺少 `AbortError` 过滤
- **plugin**: `PluginManager.emit()` 和 `logger()` 大量 `as any` 强转，改用 `HookContext` 索引签名消除
- **mock**: 注释仍写 "AI SDK v2"，实际已升级 v3
- **team**: JSDoc `*` 缩进不一致
- **tools**: `listDir` 递归模式无深度限制，新增 `maxDepth` 参数（默认 10）

### Types

- **types**: `HookContext` 增加 `[key: string]: any` 索引签名，允许 hook 额外字段类型安全传递

### Tests

- 新增 `abort.test.ts`：`ctx.abort()` 行为 + `AbortError` 属性验证（2 tests）
- 新增 `tools.test.ts`：`listDir` maxDepth / `search` maxDepth + ext / `runCommand` async + cwd + error / `readFile` error（7 tests）
- `config.test.ts`：`configure()` 输入校验（+2 tests）
- `model.test.ts`：`resetProviders()` 移除自定义 + 保留内置（+2 tests）
- 总测试数从 75 增至 88

### Docs

- **api.md**: `telemetry` 计划版本从 V2.1 更正为 V2.4
- **api.md**: 导出总览补充 `resetProviders`
- **README**: 路线图与 `docs/roadmap.md` 对齐（V2.1 契约审计、V2.2 结构化输出）
- **design.md**: 项目结构补充 `mock.ts` 和 `core/errors.ts`
- **.gitignore**: `.env.*` 排除规则增加 `!.env.example` 例外

## 2.2.1 (2026-03-22)

### Bug Fixes

- **agent**: `getConfig()` 使用 `JSON.parse(JSON.stringify())` 导致 tools/plugins/steps 等函数字段丢失，改为选择性拷贝
- **agent**: `runStream()` + steps 分支未传 `onWait`，WaitStep 在流式模式下直接抛错
- **agent**: `run()`/`runStream()`/`generate()` 入口统一触发 `beforeInput` 插件生命周期
- **loop**: `confirm: true` 工具在未配置 `onConfirm` 时静默绕过确认，改为直接抛错（安全修复）
- **loop**: `fallbackModel` 仅在 `run()` 中生效，`runLoopStream()` 和 `runGenerate()` 不支持，已补全
- **loop**: `runLoop()` 的 fallback 分支未传递 `abortSignal`，备用模型不受超时约束
- **loop**: `generate()` 传入原生 JSON Schema 对象时报 `schema is not a function`，自动包装 `jsonSchema()`
- **engine**: `ConditionalStep.retry` 实现为 retry-on-error，文档描述为 poll-until-condition-changes，对齐代码行为
- **engine**: `parallel.concurrency <= 0` 导致 `for` 循环无法推进卡死，加 `Math.max(1, ...)`
- **team**: `memberResults` 在 team 闭包级累积，多次 `run()` 串历史结果，每次 run 入口重置
- **team**: `team({ lead })` 强制转 systemPrompt 覆盖原 lead 配置，改为智能追加
- **team**: `runStream()` 只发 lead 事件，成员执行过程无流式暴露，改用 async queue multiplexing
- **team**: `streamYieldCb` 为闭包级 `let` 变量，并发 `runStream()` 互相覆盖，改为 ref 对象
- **team**: 自动创建 lead 时只取第一个成员模型，改用 `.find(Boolean)` 找到有模型的成员
- **mock**: `doGenerate` 缺少 `warnings` 字段导致 AI SDK 校验告警
- **mock**: `doStream` 缺少 `warnings` / `rawResponse` 字段
- **plugin.test**: "同名插件共享 store" 测试缺少实际断言
- **generate.test**: 文件名和注释写了 generate 但未包含 `generate()` 行为测试，已补充

### Docs

- **engine.md**: retry 行为描述从 poll-until-condition-changes 更正为 retry-on-error
- **agent-loop.md**: confirm 流程图补充「未配 onConfirm → 直接抛错」分支
- **tools.md**: 补充 `confirm: true` + 无 `onConfirm` 时抛错的安全行为说明
- **api.md**: `GenerateOptions.schema` 类型补充 `Record<string, any>` 支持原生 JSON Schema
- **api.md**: `maxCostPerRun` 计划版本从 V2.2 更正为 V2.3
- **types.ts**: `contextWindow` 计划版本从 V2.2 更正为 V2.3
- **roadmap.md**: 删除与已完成项重复的 mockModel 条目，V2.2 标记为 ✅

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
