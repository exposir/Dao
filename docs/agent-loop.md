# Agent Loop 设计文档

Agent Loop 是 Dao 的核心执行循环。每个 Agent 的 `chat()` 和 `run()` 最终都通过 Agent Loop 驱动。

---

## 1. 设计目标

- 透明简单：`while(true)` 循环，没有隐藏状态机
- 灵感来源：Gemini CLI 的 Agent Loop
- 支持流式输出
- 内置 Grace Period 超时保护

---

## 2. 核心循环

```
┌──────────────────────────────────────────────────────┐
│                    Agent Loop                         │
│                                                      │
│  1. 组装 Messages                                     │
│     └─ system prompt (role + rules + context)        │
│     └─ 用户消息 / 任务描述                              │
│     └─ 工具结果（如果有）                               │
│                                                      │
│  2. 调用模型                                          │
│     └─ Vercel AI SDK generateText / streamText       │
│                                                      │
│  3. 处理响应                                          │
│     ├─ 文本响应 → 输出给用户                            │
│     ├─ 工具调用 → 执行工具 → 回到步骤 1                  │
│     ├─ 完成信号 → 退出循环                              │
│     └─ 无响应 → Grace Period                          │
│                                                      │
│  4. 检查终止条件                                       │
│     ├─ LLM 表示任务完成                                │
│     ├─ 达到 maxTurns                                  │
│     ├─ 手动 abort                                    │
│     └─ Grace Period 超时                              │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 3. System Prompt 组装

```typescript
function buildSystemPrompt(options: AgentOptions, context?: string): string {
  const parts: string[] = []

  // 1. 自定义前缀
  if (options.systemPrompt) {
    parts.push(options.systemPrompt)
  }

  // 2. 角色定义
  if (options.role) {
    parts.push(`你是一个${options.role}。`)
  }

  // 3. 规则注入
  if (options.rules?.focus?.length) {
    parts.push(`你应该重点关注以下方面：\n${options.rules.focus.map(f => `- ${f}`).join("\n")}`)
  }
  if (options.rules?.reject?.length) {
    parts.push(`你绝对不能做以下事情：\n${options.rules.reject.map(r => `- ${r}`).join("\n")}`)
  }

  // 4. 步骤上下文（如果在 Steps 引擎中运行）
  if (context) {
    parts.push(context)
  }

  return parts.join("\n\n")
}
```

---

## 4. chat() vs run()

| | `chat()` | `run()` |
|---|---|---|
| 目的 | 对话 | 执行任务 |
| 循环 | 单轮（通常 1 次模型调用） | 多轮（直到任务完成） |
| 工具调用 | 支持 | 支持 |
| 上下文保持 | 保持完整对话历史 | 每次 run 是独立的 |
| steps | 不触发 | 触发 Steps 引擎（V0.5） |
| 完成判断 | 模型回复后就结束 | LLM 主动标记或用完 maxTurns |

**chat 流程**：
```
用户消息 → 组装 Messages → 调用模型 → 返回文本
                                  ↓
                            有工具调用？
                              ↓ 是
                         执行工具 → 再次调用模型 → 返回文本
```

**run 流程**：
```
任务描述 → 有 steps？
             ├─ 有 → Steps 引擎驱动（每步调用 Agent Loop）
             └─ 没有 → Agent Loop 自主循环直到完成
```

---

## 5. Grace Period

当 Agent 接近 maxTurns 限制时触发：

```
正常执行
  │
  ├─ 到达 maxTurns - 3？
  │   └─ 注入提醒：「你的执行轮次即将用完，请尽快总结并完成任务。」
  │
  ├─ 到达 maxTurns - 1？
  │   └─ 注入最终提醒：「这是你最后一次机会，请立即输出最终结果。」
  │
  └─ 到达 maxTurns？
      └─ 强制结束，收集已有结果
```

**实现**：
```typescript
const GRACE_THRESHOLD = 3  // 提前 3 轮开始提醒

function getGracePrompt(currentTurn: number, maxTurns: number): string | null {
  const remaining = maxTurns - currentTurn

  if (remaining === GRACE_THRESHOLD) {
    return "⚠️ 注意：你的执行轮次即将用完（剩余 3 轮），请尽快完成当前任务。"
  }
  if (remaining === 1) {
    return "🚨 这是你最后一次机会。请立即输出最终结果，不要再调用工具。"
  }
  return null
}
```

---

## 6. 工具调用流程

```
模型返回 tool_call
  │
  ├─ 查找工具注册表
  │   └─ 找不到？→ 告诉 LLM 工具不存在
  │
  ├─ confirm: true？
  │   └─ 等待用户确认
  │       ├─ 确认 → 继续
  │       └─ 拒绝 → 告诉 LLM 用户拒绝了该操作
  │
  ├─ 执行插件 beforeToolCall hooks
  │
  ├─ 执行工具
  │   ├─ 成功 → 将结果作为 tool_result 消息
  │   └─ 失败 → 将错误信息作为 tool_result 消息
  │
  ├─ 执行插件 afterToolCall hooks
  │
  └─ 回到 Agent Loop（带上 tool_result）
```

> **注意**：`rules.reject` 通过 system prompt 注入实现（见第 3 节），不在工具调用层做硬拦截。

---

## 7. 流式输出

```typescript
// 内部使用 Vercel AI SDK 的 streamText
const result = streamText({
  model: provider(modelId),
  messages,
  tools,
  onChunk: (chunk) => {
    // 触发插件 hooks
    // 通过 AsyncIterable 推送给调用者
  },
})
```

**事件流**：
```typescript
// agent.runStream() 返回的事件流
for await (const event of agent.runStream("任务")) {
  switch (event.type) {
    case "text":        // 文本片段
    case "step_start":  // Steps 引擎：开始新步骤
    case "step_end":    // Steps 引擎：步骤完成
    case "error":       // 错误
    case "done":        // 全部完成
  }
}
```

---

## 8. 记忆管理

当 `memory: true` 时：

```
chat("问题1") → 保存到 messages 历史
chat("问题2") → 带上 messages 历史调用模型
chat("问题3") → 带上所有历史调用模型
  ...
clearMemory() → 清空历史
```

**当前实现**：内存存储（数组），进程重启后丢失。messages 超出上下文窗口时报错。

**上下文窗口管理**（未来计划）：
- 自动压缩早期消息（保留最近 N 轮 + 摘要）
- 压缩策略：让 LLM 生成摘要，替换原始消息
- 需要解决 token 计数（不同模型 tokenizer 不同）和压缩调用的额外开销
