# Dao（道）

> 大道至简的 AI Agent 框架

Dao 是一个直觉优先、渐进式的 TypeScript AI Agent 框架。

## 特性

- 🎯 **描述角色，而非配置机器** — 用 `role`/`tools`/`steps`/`rules` 描述你的 Agent
- 📈 **渐进式复杂度** — 3 行代码起步，按需扩展
- 🔌 **插件生态** — 核心精简，能力通过插件扩展
- 🤖 **开源模型友好** — DeepSeek / Qwen / Kimi 开箱即用

## 快速开始

```typescript
import { agent } from "dao"

const bot = agent({ model: "deepseek/deepseek-chat" })
await bot.chat("你好")
```

## 示例

### 带工具的 Agent

```typescript
const coder = agent({
  role: "开发者",
  tools: [readFile, writeFile],
})
await coder.run("把 README.md 翻译成英文")
```

### 带步骤流程

```typescript
const reviewer = agent({
  role: "代码审查员",
  tools: [readFile, listDir],
  steps: [
    "了解项目结构",
    { parallel: ["分析前端代码", "分析后端代码"] },
    "生成审查报告",
  ],
  rules: {
    focus: ["代码质量", "安全隐患"],
    reject: ["修改代码"],
  },
})
await reviewer.run("审查 src/ 目录")
```

### 多 Agent 协作

```typescript
import { agent, team } from "dao"

const planner = agent({ role: "架构师", tools: [readFile] })
const coder = agent({ role: "开发者", tools: [readFile, writeFile] })
const tester = agent({ role: "测试工程师", tools: [readFile, runCommand] })

const squad = team({
  members: { planner, coder, tester },
})
await squad.run("给项目添加用户登录功能")
```

## 设计理念

```
chat()  →  tools  →  steps  →  rules  →  memory  →  team  →  plugins
 简单 ──────────────────────────────────────────────────────────► 复杂
```

每一层只加一两行代码，复杂度线性增长。

## 文档

详细设计文档见 [design.md](./design.md)。

## License

MIT
