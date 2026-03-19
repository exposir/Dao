# Dao（道）

> 大道至简的 AI Agent 框架

Dao 是一个直觉优先、渐进式的 TypeScript AI Agent 框架。基于 Vercel AI SDK 构建。

## 特性

- 🎯 **描述角色，而非配置机器** — 用 `role`/`tools`/`steps`/`rules` 描述你的 Agent
- 📈 **渐进式复杂度** — 3 行代码起步，按需扩展
- 🤖 **开源模型友好** — DeepSeek / Qwen / Kimi 开箱即用
- 🔌 **插件生态** — 核心精简，能力通过插件扩展
- 🏢 **企业级预留** — 可观测性、容错、安全边界等接口已预留

## 快速开始

```typescript
import { agent } from "dao-ai";

const bot = agent({ model: "deepseek/deepseek-chat" });
await bot.chat("你好");
```

## 示例

### 带工具的 Agent

```typescript
const coder = agent({
  role: "开发者",
  tools: [readFile, writeFile],
});
await coder.run("把 README.md 翻译成英文");
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
});
await reviewer.run("审查 src/ 目录");
```

### 多 Agent 协作

```typescript
import { agent, team } from "dao-ai";

const planner = agent({ role: "架构师", tools: [readFile] });
const coder = agent({ role: "开发者", tools: [readFile, writeFile] });
const tester = agent({ role: "测试工程师", tools: [readFile, runCommand] });

const squad = team({
  members: { planner, coder, tester },
});
await squad.run("给项目添加用户登录功能");
```

## 设计理念

```
chat()  →  tools  →  steps  →  rules  →  memory  →  team  →  plugins
 简单 ──────────────────────────────────────────────────────────► 复杂
```

每一层只加一两行代码，复杂度线性增长。

## 为什么选 Dao

|            | **Dao**        | **Mastra**   | **Vercel AI SDK** | **LangGraph** |
| ---------- | -------------- | ------------ | ----------------- | ------------- |
| 上手时间   | **5 分钟**     | 30+ 分钟     | 10 分钟           | 60+ 分钟      |
| 核心代码量 | < 3000 行      | 5000+ 行     | N/A               | N/A           |
| 包数量     | **1 个**       | 28 个        | N/A               | N/A           |
| API 范式   | 描述角色       | 配置基础设施 | 函数调用          | 画图          |
| 多 Agent   | `team()`       | Network      | ❌                | Graph         |
| 步骤编排   | `steps` 声明式 | 链式 API     | ❌                | 有向图        |
| 行为约束   | `rules.reject` | ❌           | ❌                | ❌            |
| 开源模型   | 开箱即用       | 需配置       | 需配置            | 需配置        |

## 路线图

| 阶段     | 内容                                                                 | 状态      |
| -------- | -------------------------------------------------------------------- | --------- |
| **V0.1** | agent + tool + Agent Loop + 模型层 + 基础 memory                     | ✅ 完成   |
| **V0.5** | steps 引擎 + rules + 上下文压缩 + wait/resume                        | ✅ 完成   |
| **V1.0** | team + plugins + 内置工具 + 完整文档                                 | ✅ 完成   |
| **未来** | 可观测性 · 容错重试 · Fallback 模型 · 成本控制 · MCP 协议 · RAG 接入 | 🔮 预留   |

## 企业级能力预留

API 已为以下能力预留扩展点，未来按需激活：

```typescript
agent({
  fallbackModel: "openai/gpt-4o", // 主模型挂了自动切换
  contextWindow: { maxTokens: 8000 }, // 上下文自动管理
  onConfirm: (tool, params) => ask(user), // 自定义确认方式
  modelProvider: mockModel, // 测试时注入 mock
});

configure({
  retry: { maxRetries: 3, backoff: true }, // 模型调用自动重试
  telemetry: { enabled: true }, // 链路追踪
  maxCostPerRun: 0.5, // 单次成本上限
});
```

## 文档

详细文档见 [docs/](./docs/README.md)。

## License

MIT
