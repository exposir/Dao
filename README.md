# Dao（道）

> 大道至简的 AI Agent 框架

Dao 是一个直觉优先、渐进式的 TypeScript AI Agent 框架。基于 Vercel AI SDK 构建。

## 特性

- 🎯 **描述角色，而非配置机器** — 用 `role`/`tools`/`steps`/`rules` 描述你的 Agent
- 📈 **渐进式复杂度** — 3 行代码起步，按需扩展
- 🤖 **开源模型友好** — DeepSeek / Qwen / Kimi 开箱即用
- 🔌 **插件生态** — 核心精简，能力通过插件扩展
- 🛡️ **生产可靠** — 重试、超时、错误分类、Fallback 模型
- ✅ **输出校验** — guardrail 代码级校验 + 自动重试

## 快速开始

```typescript
import { agent } from "dao-ai";

const bot = agent({ model: "deepseek/deepseek-chat" });
await bot.chat("你好");
```

## 示例

### 简单模式（goal + background）

```typescript
const auditor = agent({
  goal: "找出代码中的 bug 和安全隐患",
  background: "你有 10 年 TypeScript 经验",
  tools: [readFile, listDir],
});
await auditor.run("审查 src/ 目录");
```

### 专家模式（systemPrompt）

```typescript
const bot = agent({
  systemPrompt: "你是 JSON 格式化专家，只输出合法 JSON",
});
```

### 带步骤流程 + 输出校验

```typescript
const reviewer = agent({
  role: "代码审查员",
  tools: [readFile, listDir],
  steps: [
    "了解项目结构",
    { parallel: ["分析前端代码", "分析后端代码"], concurrency: 2 },
    {
      task: "生成审查报告",
      output: "JSON 格式，包含 severity 和 message 字段",
      validate: (r) => {
        try { JSON.parse(r); return true }
        catch { return "输出不是合法 JSON" }
      },
      maxRetries: 2,
    },
    { wait: true, reason: "等待用户确认" },
    "根据用户反馈修改报告",
  ],
});

const promise = reviewer.run("审查 src/ 目录");
// ... 等待 wait 步骤暂停后
reviewer.resume({ approved: true });
await promise;
```

### 工具确认机制

```typescript
const bot = agent({
  tools: [
    tool({ name: "deleteFile", confirm: true, ... }),
  ],
  onConfirm: async (toolName, params) => {
    return await ask(`确认执行 ${toolName}?`);
  },
});
```

### 容错配置

```typescript
const bot = agent({
  model: "deepseek/deepseek-chat",
  fallbackModel: "openai/gpt-4o",     // 主模型出错或超时，自动切换备用模型
  retry: { maxRetries: 3 },           // 自动重试 + 指数退避
  timeout: 30000,                     // 30 秒超时
  maxTokens: 2000,                    // 限制输出长度
});
```

### Agent 委派（无需 team）

```typescript
const researcher = agent({ role: "研究员", tools: [search] });
const writer = agent({ role: "作家" });

const lead = agent({
  role: "项目经理",
  delegates: { researcher, writer },
});
// lead 会自动调用 delegate 工具分配任务
await lead.run("写一篇关于 AI Agent 的文章");
```

### 多 Agent 团队

```typescript
import { agent, team } from "dao-ai";

const squad = team({
  members: {
    planner: agent({ role: "架构师" }),
    coder: agent({ role: "开发者", tools: [readFile, writeFile] }),
    tester: agent({ role: "测试工程师", tools: [runCommand] }),
  },
});
await squad.run("给项目添加用户登录功能");
```

### 流式事件

```typescript
for await (const event of bot.runStream("分析代码")) {
  switch (event.type) {
    case "step_start": console.log(`▶ 步骤 ${event.data.index}`); break
    case "step_end":   console.log(`✓ 完成`); break
    case "tool_call":  console.log(`🔧 ${event.data.tool}`); break
    case "text":       process.stdout.write(event.data); break
    case "done":       console.log("完成"); break
  }
}
```

### 错误处理

```typescript
import { ModelError, ToolError, TimeoutError } from "dao-ai";

try {
  await bot.run("任务");
} catch (e) {
  if (e instanceof TimeoutError) console.log("超时");
  if (e instanceof ModelError)   console.log("模型错误");
  if (e instanceof ToolError)    console.log(`工具 ${e.toolName} 失败`);
}
```

## 设计理念

```
chat()  →  tools  →  steps  →  rules  →  memory  →  team  →  plugins
 简单 ──────────────────────────────────────────────────────────► 复杂
```

每一层只加一两行代码，复杂度线性增长。

## 路线图

| 阶段     | 内容                                         | 状态    |
| -------- | -------------------------------------------- | ------- |
| **V0.1** | agent + tool + Agent Loop + memory           | ✅      |
| **V0.5** | steps + rules + parallel + if + wait/resume  | ✅      |
| **V1.0** | team + plugins + 内置工具 + 文档             | ✅      |
| **V1.1** | 重试 + 超时 + 错误分类 + maxTokens + 并发    | ✅      |
| **V1.2** | goal/background + expected_output + guardrail| ✅      |
| **V2.0** | confirm + 流式事件 + fallback + delegates    | ✅      |
| **V2.1** | 契约审计 + 测试覆盖 + 文档对齐            | ✅      |
| **V2.2** | 结构化输出 + 可测试性 + mock              | ✅      |
| **V2.3** | 上下文管理 + 成本控制 + 流式 steps        | 📋      |
| **V2.4** | 多模态 + MCP + 可观测                     | 📋      |

## 文档

详细文档见 [docs/](./docs/index.md)。

## License

MIT
