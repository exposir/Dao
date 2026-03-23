# 团队系统设计文档

---

## 1. 核心架构

`team()` 的底层是**单 Agent 调度架构**：一个 lead Agent 做决策，通过工具调用来委派任务给 members。

```
team.run("任务")
  │
  └─ Lead Agent（调度员）
       │
       ├─ delegate({ member: "planner", task: "分析需求" }) → planner.run()
       ├─ delegate({ member: "coder", task: "实现登录" }) → coder.run()
       └─ delegate({ member: "tester", task: "测试登录" }) → tester.run()
```

---

## 2. Lead Agent 自动生成

当用户不指定 `lead` 时，框架自动生成：

```typescript
function createAutoLead(
  members: Record<string, AgentInstance>,
  maxRounds: number,
): AgentInstance {
  // 1. 收集所有成员信息
  const memberDescriptions = Object.entries(members)
    .map(([name, member]) => {
      const config = member.getConfig()
      return `- ${name}（${config.role || "通用 Agent"}）`
    })
    .join("\n")

  // 2. 创建单个 delegate 工具
  const delegateTool = tool({
    name: "delegate",
    description: `将任务委派给团队成员。可用成员：\n${memberDescriptions}`,
    params: { member: "Agent 名称", task: "任务描述" },
    run: async ({ member, task }) => {
      const memberAgent = members[member]
      const result = await memberAgent.run(task)
      return result.output
    },
  })

  // 3. 创建 lead Agent
  return agent({
    role: "团队调度员",
    maxTurns: maxRounds ?? 20,
    systemPrompt: `你是一个团队的调度员。...`,
    tools: [delegateTool],
  })
}
```

---

## 3. 自定义 Lead

```typescript
const squad = team({
  lead: agent({
    role: "项目经理",
    steps: [
      "先让架构师分析需求",
      "根据方案让开发者实现",
      { parallel: ["让测试工程师写测试", "让开发者写文档"] },
      "汇总所有结果",
    ],
  }),
  members: { planner, coder, tester },
})
```

自定义 lead 时，框架仍然自动注入 delegate 工具，但 lead 的行为由用户的 `steps` 控制。

> **maxRounds 语义**：`maxRounds` 等价于 lead Agent 的 `maxTurns`——即 lead 的模型调用轮次上限，默认值为 20。到达上限时 AI SDK 直接停止循环。

---

## 4. 成员间通信

成员之间不直接通信。所有信息通过 lead 中转：

```
planner.run("分析需求")
  → 返回结果给 lead
    → lead 决定下一步
      → coder.run("实现方案：{planner的结果}")
        → 返回结果给 lead
          → lead 汇总
```

**设计原因**：
- 简单可预测——信息流向清晰
- 避免成员间死循环
- lead 可以根据中间结果调整策略

---

## 5. delegate 工具 — 委派机制

自动 lead 和自定义 lead **共用同一个 `delegate` 工具**。内部根据 `member` 参数找到成员并执行。

```typescript
const delegateTool = tool({
  name: "delegate",
  description: `将任务委派给团队成员执行。\n可用成员：\n${memberDescriptions}`,
  params: {
    member: "团队成员名称",
    task: "要委派的任务描述",
  },
  run: async ({ member: memberName, task }) => {
    const memberAgent = members[memberName]
    if (!memberAgent) {
      return `错误：成员 "${memberName}" 不存在。可用成员：${Object.keys(members).join(", ")}`
    }
    const result = await memberAgent.run(task)
    return result.output  // 只返回 output 给 lead
  },
})
```

---

## 6. 执行流程

```typescript
async function teamRun(options: TeamOptions, task: string): Promise<TeamRunResult> {
  const { members, lead, maxRounds, plugins } = options

  // 1. 创建单个通用 delegate 工具
  const memberResults: Record<string, RunResult[]> = {}
  const delegateTool = tool({
    name: "delegate",
    description: `将任务委派给团队成员。`,
    params: { member: "Agent 名称", task: "任务描述" },
    run: async ({ member, task }) => {
      const result = await members[member].run(task)
      // 自动收集 memberResults
      if (!memberResults[member]) memberResults[member] = []
      memberResults[member].push(result)
      return result.output
    },
  })

  // 2. 创建 lead（自定义或自动生成）
  let leadAgent: AgentInstance
  if (lead) {
    const config = lead.getConfig()
    leadAgent = agent({
      ...config,
      maxTurns: maxRounds ?? config.maxTurns ?? 20,
      tools: [...(config.tools || []), delegateTool],
    })
  } else {
    leadAgent = agent({
      role: "团队负责人",
      maxTurns: maxRounds ?? 20,
      tools: [delegateTool],
    })
  }

  // 3. 执行前重置 memberResults（防跨 run 累积）
  for (const name of Object.keys(memberResults)) memberResults[name] = []
  const result = await leadAgent.run(task)

  // 聚合 lead + 所有 member 的 token 用量
  const allResults = Object.values(memberResults).flat()
  const totalUsage = {
    promptTokens: result.usage.promptTokens + allResults.reduce((s, r) => s + r.usage.promptTokens, 0),
    completionTokens: result.usage.completionTokens + allResults.reduce((s, r) => s + r.usage.completionTokens, 0),
    totalTokens: result.usage.totalTokens + allResults.reduce((s, r) => s + r.usage.totalTokens, 0),
  }

  return {
    output: result.output,
    memberResults: JSON.parse(JSON.stringify(memberResults)), // 深拷贝防外部污染
    usage: totalUsage,
    duration: Date.now() - startTime,
  }
}
```

> **memberResults 数据链路**：delegate 工具每次调用 `member.run()` 时自动将完整 RunResult push 到 `memberResults` 中。

---

## 7. 错误处理

| 场景 | 行为 |
|---|---|
| 成员执行失败 | 错误信息返回给 lead → lead 决定是否重试或跳过 |
| Lead 达到 maxRounds | AI SDK 停止循环，返回已有结果 |
| 成员超时 | 返回超时信息给 lead |
| 所有成员都失败 | lead 汇总错误信息输出 |

---

## 8. Agent 级委派（delegates）

V2.0 新增。无需 `team()`，单个 agent 可直接委派任务：

```typescript
const researcher = agent({ role: "研究员" })
const writer = agent({ role: "写手" })

const lead = agent({
  role: "项目经理",
  delegates: { researcher, writer },  // 自动注入 delegate 工具
})

await lead.run("写一篇关于 AI 的文章")
// lead 可以自主委派子任务给 researcher 和 writer
```

---

## 9. 并发限制

> [!WARNING]
> **同一个 team 实例同一时间只能执行一个 `run()` 或 `runStream()`。** 并发调用会导致 `memberResults` 和流式事件互相污染。

```typescript
// ❌ 错误：并发调用同一个 team 实例
const squad = team({ members: { coder, tester } })
await Promise.all([
  squad.run("任务A"),  // memberResults 会互相污染
  squad.run("任务B"),
])

// ✅ 正确：串行执行
const result1 = await squad.run("任务A")
const result2 = await squad.run("任务B")

// ✅ 正确：创建多个 team 实例并行
const squad1 = team({ members: { coder, tester } })
const squad2 = team({ members: { coder, tester } })
await Promise.all([squad1.run("任务A"), squad2.run("任务B")])
```

**原因**：`memberResults` 和 `streamRef.yieldCb` 是 team 实例级闭包状态，不支持 per-run 隔离。

---

## 10. 自定义 lead 的重建机制（By Design）

`team({ lead })` **不会直接使用**传入的 lead 实例运行，这是有意的设计。框架会：

1. 调用 `lead.getConfig()` 提取配置
2. 用 `agent({ ...config, tools: [...config.tools, delegateTool] })` 创建一个新实例
3. 原 lead 的 memory 历史、插件 store、闭包状态都**不会被继承**

```typescript
const myLead = agent({ role: "PM", memory: true })
await myLead.chat("记住 X=1")  // 存入 myLead 的 memory

const squad = team({ lead: myLead, members: { coder } })
await squad.run("任务")  
// ⚠️ squad 的内部 lead 不会知道 X=1，因为它是重建的新实例
```

如果需要 lead 保持状态，建议在 team 外部管理状态，通过 `systemPrompt` 或 `background` 传递上下文。

---

## 11. 流式模式数据链路

`runStream()` 和 `run()` 的 delegate 调用路径不同：

| 模式 | delegate 调用方式 | 事件暴露 |
|------|------------------|---------|
| `run()` | `member.run(task)` | 无中间事件 |
| `runStream()` | `member.runStream(task)` | 成员的 text/done 事件会实时合并到 team 的事件流 |

流式模式下，成员执行的中间过程（文本片段、tool_call 等）会通过 async queue 实时推送，每个事件带有 `member` 字段标识来源。
