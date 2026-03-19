# 团队系统设计文档

---

## 1. 核心架构

`team()` 的底层是**单 Agent 调度架构**：一个 lead Agent 做决策，通过工具调用来委派任务给 members。

```
team.run("任务")
  │
  └─ Lead Agent（调度员）
       │
       ├─ delegate_to_planner("分析需求") → planner.run()
       ├─ delegate_to_coder("实现登录") → coder.run()
       └─ delegate_to_tester("测试登录") → tester.run()
```

---

## 2. Lead Agent 自动生成

当用户不指定 `lead` 时，框架自动生成：

```typescript
function createAutoLead(members: Record<string, AgentInstance>): AgentInstance {
  // 1. 收集所有成员信息
  const memberDescriptions = Object.entries(members)
    .map(([name, member]) => {
      const config = member.getConfig()
      return `- ${name}（${config.role || "通用 Agent"}）`
    })
    .join("\n")

  // 2. 为每个成员生成委派工具
  const delegateTools = Object.entries(members).map(([name, member]) => {
    const config = member.getConfig()
    return tool({
      name: `delegate_to_${name}`,
      description: `委派任务给${config.role || name}。`,
      params: { task: String },
      run: async ({ task }) => {
        const result = await member.run(task)
        return result.output
      },
    })
  })

  // 3. 创建 lead Agent
  return agent({
    role: "团队调度员",
    systemPrompt: `你是一个团队的调度员。你的团队成员有：
${memberDescriptions}

你需要根据任务需求，合理地分配任务给团队成员。
规则：
- 分析任务后决定委派顺序
- 一个成员的输出可以作为另一个成员的输入
- 所有成员完成后汇总结果`,
    tools: delegateTools,
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

## 5. 执行流程

```typescript
async function teamRun(options: TeamOptions, task: string): Promise<TeamRunResult> {
  const { lead, members, maxRounds = 20 } = options

  // 1. 创建或使用 lead
  const leadAgent = lead || createAutoLead(members)

  // 2. 注入 delegate 工具（如果是自定义 lead）
  if (lead) {
    injectDelegateTools(leadAgent, members)
  }

  // 3. 执行 lead
  const result = await leadAgent.run(task)

  // 4. 收集成员执行记录
  const memberResults = collectMemberResults(members)

  return {
    output: result.output,
    memberResults,
    usage: aggregateUsage(result, memberResults),
    duration: result.duration,
  }
}
```

---

## 6. 错误处理

| 场景 | 行为 |
|---|---|
| 成员执行失败 | 错误信息返回给 lead → lead 决定是否重试或跳过 |
| Lead 达到 maxRounds | Grace Period → 强制汇总已有结果 |
| 成员超时 | 返回超时信息给 lead |
| 所有成员都失败 | lead 汇总错误信息输出 |
