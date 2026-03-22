# Agent Loop 设计文档

Agent Loop 是 Dao 的核心执行循环。每个 Agent 的 `chat()` 和 `run()` 最终都通过 Agent Loop 驱动。

---

## 1. 设计目标

- 透明简单：`while(true)` 循环，没有隐藏状态机
- 灵感来源：Gemini CLI 的 Agent Loop
- 支持流式输出
- 内置 maxTurns 上限保护

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
│     └─ 无响应 → 继续循环                          │
│                                                      │
│  4. 检查终止条件                                       │
│     ├─ LLM 表示任务完成                                │
│     ├─ 达到 maxTurns                                  │
│     ├─ 手动 abort                                    │
│     └─ AI SDK stepCountIs 截断                        │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 3. System Prompt 组装

```typescript
function buildSystemPrompt(options: AgentOptions): string {
  // 专家模式：systemPrompt 存在时直接用，忽略 role/goal/background
  if (options.systemPrompt) {
    const rulesPrompt = compileRules(options.rules)
    return rulesPrompt
      ? `${options.systemPrompt}\n\n${rulesPrompt}`
      : options.systemPrompt
  }

  const parts: string[] = []

  // 简单模式：拼接 role + goal + background
  if (options.role) {
    parts.push(`你的角色是：${options.role}`)
  }
  if (options.goal) {
    parts.push(`你的目标是：${options.goal}`)
  }
  if (options.background) {
    parts.push(`背景：${options.background}`)
  }

  // 规则注入
  const rulesPrompt = compileRules(options.rules)
  if (rulesPrompt) {
    parts.push(rulesPrompt)
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

## 5. maxTurns 上限

当 Agent 达到 maxTurns 限制时，使用 AI SDK 的 `stepCountIs()` 直接停止循环：

```
正常执行
  │
  └─ 到达 maxTurns？
      └─ AI SDK 停止模型调用，返回当前已有结果
```

当前实现没有 Grace Period（提前提醒机制）。`maxTurns` 是硬性上限，到达后直接结束。

---

## 6. 工具调用流程

```
模型返回 tool_call
  │
  ├─ 查找工具注册表
  │   └─ 找不到？→ 告诉 LLM 工具不存在
  │
  ├─ confirm: true？
  │   ├─ 未配置 onConfirm？→ 直接抛错（安全设计）
  │   └─ 有 onConfirm → 等待用户确认
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
    case "step_start":  // 步骤开始（steps 模式）
    case "step_end":    // 步骤完成
    case "tool_call":   // 工具调用结果
    case "text":        // 文本片段
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
