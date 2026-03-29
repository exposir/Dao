# 多 Agent 协作

当单个 Agent 能力不够时，用 `team()` 把多个 Agent 组织起来分工协作。

## 最小示例

```typescript
import { agent, team, tool } from "dao-ai"
import { search } from "dao-ai/tools"

const researcher = agent({
  model: "deepseek/deepseek-chat",
  role: "研究员",
  tools: [search],
})

const writer = agent({
  model: "deepseek/deepseek-chat",
  role: "作家",
  tools: [writeFile],
})

const squad = team({ members: { researcher, writer } })

const result = await squad.run("写一篇关于量子计算的文章")
```

team 会自动选一个 `lead` Agent 接收用户任务，然后通过 `delegate` 工具把子任务分发给成员。

## 成员角色设计

team 成员的职责通过 `role` 和 `goal` 描述，由 lead 自己决定分发给谁：

```typescript
const planner = agent({
  model: "deepseek/deepseek-chat",
  role: "架构师",
  goal: "将复杂任务拆解为可执行的步骤",
  tools: [readFile, listDir],
})

const frontend = agent({
  model: "deepseek/deepseek-chat",
  role: "前端工程师",
  goal: "实现 UI 组件和页面",
  tools: [readFile, writeFile, runCommand],
})

const backend = agent({
  model: "deepseek/deepseek-chat",
  role: "后端工程师",
  goal: "实现 API 和数据层",
  tools: [readFile, writeFile, runCommand],
})

const tester = agent({
  model: "deepseek/deepseek-chat",
  role: "测试工程师",
  goal: "编写和运行测试，确保功能正确",
  tools: [runCommand],
})

const squad = team({
  members: { planner, frontend, backend, tester },
})
```

## delegate 机制

team 内部的协作通过 `delegate` 工具实现。当 lead 需要某个成员处理子任务时：

1. lead 调用 `delegate` 工具，指定 `member`（成员名）和 `task`（任务描述）
2. 框架把任务转发给对应成员 Agent
3. 成员执行完后，结果返回给 lead
4. lead 汇总后继续或结束

成员也可以再 delegate，形成多层协作树。

## 配置 lead

默认使用 `members` 中的第一个作为 lead。可以手动指定：

```typescript
const squad = team({
  lead: reviewer,      // 指定评审员作为主控
  members: { planner, coder, reviewer },
})
```

## 共享上下文

members 之间可以通过 `workspace` 共享数据：

```typescript
const squad = team({
  members: { planner, coder },
})

// planner 在 workspace 中写入设计文档
// coder 可以直接读取
```

## 并行分发

如果 lead 判断多个子任务互相独立，可以并行 delegate：

```typescript
// lead Agent 会自动识别并行机会
const squad = team({
  members: {
    frontend: agent({ role: "前端", tools: [writeFile] }),
    backend: agent({ role: "后端", tools: [writeFile] }),
  },
})

await squad.run("同时开发用户模块的前端和后端")  // 前端后端并行工作
```

## 容错与 Fallback

容错由各 Agent 各自的配置决定。在创建成员时传入容错参数：

```typescript
const coder = agent({
  model: "deepseek/deepseek-chat",
  retry: { maxRetries: 2 },    // 单次模型调用失败时自动重试
  timeout: 60000,               // 超时时间
  fallbackModel: "openai/gpt-4o", // 主模型失败时自动切换
})

const squad = team({
  members: { coder },
})
```

## 与 delegates 参数的区别

`agent({ delegates: {...} })` 是单 Agent 级的委派，不需要显式创建 team。`delegates` 是 `Record<string, AgentInstance>` 键值对，Agent 内部会注入一个 `delegate` 工具：

```typescript
// 单 Agent 内的委派 — 适合简单场景
const bot = agent({
  delegates: {
    calculator: agent({ role: "计算器", tools: [calc] }),
    searcher: agent({ role: "搜索助手", tools: [search] }),
  },
})

// team — 适合复杂场景，有明确的 lead 编排逻辑
const squad = team({
  members: { planner, coder, tester },
})
```

当任务简单且 Agent 数量少时用 `delegates`；当需要 lead 统筹多个专业角色时用 `team()`。

## 下一步

- [API 参考：team](/api#team) — 完整的参数定义
- [插件系统](/guide/plugins) — 给 team 添加日志、监控等能力
- [Agent Loop](/agent-loop) — delegate 在循环中如何工作
- [examples/README.md](https://github.com/exposir/Dao/blob/main/examples/README.md) — 更多可运行的示例
