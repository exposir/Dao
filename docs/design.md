# Dao（道）— 大道至简的 AI Agent 框架

## 一、项目定位

**Dao** 是一个直觉优先、渐进式的 TypeScript AI Agent 框架。

> **直觉优先 · 渐进式 · 开源模型友好**

```typescript
import { agent } from "dao"

const bot = agent({ model: "deepseek/deepseek-chat" })
await bot.chat("你好")
```

### 目标用户

- TypeScript / 前端开发者
- 想用 AI Agent 但被 Mastra / LangChain 吓退的人
- 想从简单场景起步、逐步构建复杂应用的团队

### 解决的问题

| 痛点 | Dao 的解法 |
|---|---|
| Mastra 太重（28 个包，agent.ts 5375 行） | 核心精简，一个包搞定 |
| Vercel AI SDK 太薄（没有 Loop/Memory/权限） | 内置 Agent Loop、权限、策略 |
| 没有真正直觉的 TS Agent 框架 | API 望文生义，开箱即用 |
| API 不直觉（`getDefaultGenerateOptionsLegacy()`） | `role`/`tools`/`steps`，望文生义 |
| 从简单到复杂，门槛断崖式上升 | 渐进式，复杂度线性增长 |

---

## 二、核心设计理念

### 2.1 描述角色，而非配置机器

传统框架让你"配置一台机器"：

```typescript
// ❌ 传统方式：你在想"引擎、零件、参数"
const agent = new Agent({
  model: createDeepSeek({ modelId: "deepseek-chat", apiKey: "..." }),
  tools: [tool({ description: "...", parameters: z.object({...}), execute: ... })],
  memory: new Memory({ storage: new PostgresStore({ connectionString: "..." }) }),
  maxSteps: 20,
})
```

Dao 让你"描述一个角色"：

```typescript
// ✅ Dao：你在想"这个人干什么、能用什么、怎么干"
const reviewer = agent({
  role: "代码审查员",
  tools: [readFile, listDir],    // tool() 定义的工具
  steps: ["分析", "审查", "总结"],
  rules: { reject: ["修改代码"] },
  memory: true,
})
```

### 2.2 渐进式复杂度

每一层只加一两行代码，复杂度线性增长：

```
chat()  →  tools  →  steps  →  rules  →  memory  →  team  →  plugins
 简单 ──────────────────────────────────────────────────────────► 复杂
```

### 2.3 直觉优先

- **API 望文生义**：`tools`、`steps`、`rules`——开发者全认识
- **开箱即用**：默认配置就够用，不需要先搞懂 10 个概念
- **开源模型友好**：DeepSeek、Qwen 等开源模型开箱即用

---

## 三、核心 API 设计

### 3.1 agent() — 创建 Agent

```typescript
import { agent } from "dao"

const bot = agent({
  // 身份
  role: "代码审查员",              // 角色描述
  model: "deepseek/deepseek-chat", // 模型（provider/model 格式）

  // 能力
  tools: [readFile, writeFile],    // 可用工具（tool() 定义）

  // 工作方式
  steps: [                         // 步骤列表（可选）
    "了解项目结构",
    { parallel: ["分析前端", "分析后端"] },
    "汇总分析结果",
    { if: "发现安全隐患", then: "标记为高优先级" },
    "生成审查报告",
  ],

  // 规则
  rules: {
    focus: ["代码质量", "安全隐患"],  // 关注点
    reject: ["修改代码", "执行命令"], // 禁止行为
  },

  // 增强
  memory: true,                    // 开启记忆（默认关闭）
  plugins: [logger()],             // 插件
})

// 使用
await bot.chat("你好")                    // 对话模式
await bot.run("审查 src/ 目录下的代码")     // 任务模式
```

### 3.2 team() — 创建团队（V1.0 计划）

```typescript
import { agent, team } from "dao"

const planner = agent({
  role: "架构师",
  tools: [readFile, listDir],
  steps: ["分析需求", "制定方案", "拆分任务"],
  rules: { reject: ["直接写代码"] },
})

const coder = agent({
  role: "开发者",
  tools: [readFile, writeFile, runCommand],
})

const tester = agent({
  role: "测试工程师",
  tools: [readFile, runCommand],
  steps: [
    "编写测试用例",
    "运行测试",
    { if: "测试失败", then: "反馈给开发者", retry: 3 },
    "生成测试报告",
  ],
})

// 简单模式：框架自动生成调度 Agent
const squad = team({
  members: { planner, coder, tester },
})

// 高级模式：自定义调度逻辑
const squad = team({
  lead: agent({
    role: "项目经理",
    steps: ["优先让架构师分析", "再分配给开发者"],
  }),
  members: { planner, coder, tester },
})

await squad.run("给项目添加用户登录功能")
```

> **架构说明**：`team()` 底层是单 Agent 架构——lead 做决策，members 被调用。但开发者看到的是"团队协作"。计划在 V1.0 实现。

### 3.3 tool() — 定义工具

```typescript
import { tool } from "dao"

// 基础用法
const readFile = tool({
  name: "readFile",
  description: "读取文件内容",
  params: { path: "文件路径" },
  run: ({ path }) => fs.readFileSync(path, "utf-8"),
})

// 需要确认时加 confirm
const writeFile = tool({
  name: "writeFile",
  description: "写入文件",
  params: { path: "文件路径", content: "文件内容" },
  run: ({ path, content }) => fs.writeFileSync(path, content),
  confirm: true,
})

// 非 string 类型时显式指定
const deleteFiles = tool({
  name: "deleteFiles",
  description: "批量删除文件",
  params: {
    paths: { type: "array", description: "文件路径列表" },
    force: { type: "boolean", description: "是否强制删除" },
  },
  run: ({ paths, force }) => ...,
})
```

> **设计原则**：所有 API 统一传一个对象。不需要 Zod，框架内部自动转为 JSON Schema。

### 3.4 完整示例：Agent 嵌套调用

```typescript
const researcher = agent({
  role: "调研员",
  tools: [search, readFile],
})

const writer = agent({
  role: "技术作者",
  tools: [writeFile],
})

const lead = agent({
  role: "项目负责人",
  steps: [
    { parallel: [
      () => researcher.run("调研 React 最新趋势"),
      () => researcher.run("调研 AI 前端应用"),
    ]},
    "根据调研结果制定文章大纲",
    (ctx) => writer.run(`按以下大纲写文章：${ctx.lastResult}`),
    { wait: "请审查文章内容" },  // V0.5 计划
    "发布",
  ],
})

await lead.run("写一篇前端技术趋势文章")
```

---

## 四、技术架构

```
┌─────────────────────────────────────────┐
│              开发者 API 层               │
│    agent()  /  team()  /  tool()        │
├─────────────────────────────────────────┤
│              核心引擎层                  │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │Agent Loop│ │Steps 引擎│ │工具系统  │ │
│  └──────────┘ └──────────┘ └─────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │  Memory  │ │  Rules   │ │ Plugins │ │
│  └──────────┘ └──────────┘ └─────────┘ │
├─────────────────────────────────────────┤
│              模型调用层                  │
│         Vercel AI SDK (ai)              │
│   DeepSeek  /  OpenAI  /  Gemini       │
└─────────────────────────────────────────┘
```

### 4.1 Agent Loop

核心执行循环，灵感来自 Gemini CLI 的 `while(true)` 模式：

```
开始 → 组装 Prompt（role + rules + context）
     → 调用模型
     → 模型返回文本？→ 输出
     → 模型返回工具调用？→ 执行工具 → 回到"调用模型"
     → 模型返回完成信号？→ 结束
     → 超时？→ Grace Period（最后一次机会）→ 结束
```

### 4.2 Steps 引擎

将 `steps` 步骤列表编译为执行逻辑：

| 步骤类型 | 输入 | 引擎行为 |
|---|---|---|
| `"字符串"` | LLM 指令 | 交给 Agent Loop 执行 |
| `{ parallel: [...] }` | 并行任务 | `Promise.allSettled()` |
| `{ if, then, else?, retry? }` | 条件分支 | LLM 判断或代码判断，可带重试 |
| `{ wait: "..." }` | 暂停等待 | suspend → 序列化→ 等待恢复（V0.5） |
| `(ctx) => ...` | 自定义函数 | 直接执行 |

> **设计原则**：90% 场景用声明式步骤，10% 复杂场景混入函数。

### 4.3 工具系统

```
tool() 定义 → 
  简写参数转 JSON Schema → 
    注册到 Agent → 
      模型调用时匹配并执行
```

> 不依赖 Zod，不依赖 TypeScript 类型推导。用户写 `{ path: "文件路径" }`，框架转为 `{ type: "object", properties: { path: { type: "string", description: "文件路径" } } }`。

### 4.4 模型层

基于 Vercel AI SDK，统一 `provider/model` 格式。开源模型优先排列：

#### 开源 / 性价比模型

| 模型 | provider | 用法 | 支持方式 |
|---|---|---|---|
| **DeepSeek** | `@ai-sdk/deepseek` | `"deepseek/deepseek-chat"` | 官方 |
| **月之暗面 Kimi** | `@ai-sdk/moonshotai` | `"moonshotai/kimi-k2.5"` | 官方 |
| **阿里通义千问 Qwen** | `@ai-sdk/alibaba` | `"alibaba/qwen3-max"` | 官方 |
| **智谱 GLM** | `@ai-sdk/zhipu` | `"zhipu/glm-4-plus"` | 官方 |
| **MiniMax** | 社区包 | `"minimax/minimax-m2"` | 社区 |
| **百川 / Yi / 豆包** | OpenAI 兼容 | 通过 `openai-compatible` 接入 | 兼容 |

#### 商业模型

| 模型 | 用法 |
|---|---|
| **OpenAI** | `"openai/gpt-4o"` |
| **Google Gemini** | `"google/gemini-2.5-pro"` |
| **Anthropic Claude** | `"anthropic/claude-sonnet-4-5"` |
| **xAI Grok** | `"xai/grok-4"` |

```typescript
// 开源模型用法示例
const bot = agent({
  model: "deepseek/deepseek-chat",  // 默认推荐
})

const kimi = agent({
  model: "moonshotai/kimi-k2.5",   // 月之暗面
})

const qwen = agent({
  model: "alibaba/qwen3-max",      // 通义千问
})
```

通过 `.env` 文件配置 API Key：

```env
# 开源模型
DEEPSEEK_API_KEY=sk-xxx
MOONSHOT_API_KEY=sk-xxx
ALIBABA_API_KEY=sk-xxx

# 商业模型
OPENAI_API_KEY=sk-xxx
GOOGLE_API_KEY=xxx
```

---

## 五、插件系统

### 5.1 Hook 生命周期

```
beforeInput → beforeModelCall → afterModelCall → beforeToolCall → afterToolCall → afterStep → onComplete / onError
```

### 5.2 插件接口

```typescript
import { plugin } from "dao"

// 工厂函数：调用后返回插件实例
function logger() {
  return plugin({
    name: "logger",
    hooks: {
      beforeModelCall: (ctx) => { console.log("调用模型:", ctx.prompt) },
      afterToolCall: (ctx) => { console.log("工具结果:", ctx.result) },
      onError: (ctx) => { console.error("出错:", ctx.error) },
    },
  })
}

// 使用
const bot = agent({ plugins: [logger()] })
```

### 5.3 核心 vs 插件

| 核心内置 | 通过插件扩展 |
|---|---|
| Agent Loop | Observability（可观测性） |
| Steps 引擎 | Scorers（质量评估） |
| 工具系统 | Schema 校验 |
| Memory 基础版 | MCP 协议支持 |
| Rules 权限 | 高级 Memory（向量存储等） |
| 流式输出 | 自定义 UI 集成 |

---

## 六、竞品对比

### 6.1 主要竞品矩阵

| | **Dao** | **Mastra** | **Vercel AI SDK** | **LangGraph** | **VoltAgent** | **easy-agent** |
|---|---|---|---|---|---|---|
| 语言 | TypeScript | TypeScript | TypeScript | TypeScript | TypeScript | TypeScript |
| 中文文档 | ✅ 优先 | ❌ | ❌ | ❌ | ❌ | ❌ |
| API 范式 | 描述角色 | 配置基础设施 | 函数调用 | 画图 | 声明式 | 极简类 |
| 上手时间 | 5 分钟 | 30+ 分钟 | 10 分钟 | 60+ 分钟 | 15 分钟 | 5 分钟 |
| 多 Agent | `team()` | Network | ❌ 自己写 | Graph | supervisor | ❌ |
| Workflow | `steps` 列表 | 链式 API | ❌ 没有 | 有向图 | workflow engine | ❌ |
| Memory | `memory: true` | 需要配置 | ❌ 自己写 | 需要配置 | ✅ 内置 | ❌ |
| 权限 | `rules.reject` | ❌ | ❌ | ❌ | ❌ | ❌ |
| 核心代码量 | 目标 < 3000 行 | 5000+ 行 | N/A | N/A | 中等 | < 500 行 |

### 6.2 核心差异化

1. **唯一行为描述式 API**（role/tools/steps/rules）— 开发者描述角色，不是配置机器
2. **步骤列表替代流程图** — LLM 做决策，开发者给方向
3. **`rules.reject` 内置权限** — 其他框架均无
4. **开源模型开箱即用** — DeepSeek、Qwen 默认支持

### 6.3 最接近的竞品分析

| 框架 | 相似点 | Dao 的优势 |
|---|---|---|
| **VoltAgent** | 声明式、TS 原生、可观测性 | Dao 有 steps 引擎、rules 权限、更直觉的 API |
| **easy-agent** | 极简、轻量 | Dao 有 team、steps、memory，能力完整 |
| **KaibanJS** | 角色定义、多 Agent | Dao 用声明式步骤，KaibanJS 用看板管理 |
| **PraisonAI** | 多 Agent、低代码 | Dao 是 TS 原生，PraisonAI 从 Python 移植 |
| **Strands SDK** | 简单几行代码 | Dao 独立不绑定 AWS |
| **Google ADK** | 代码优先、模块化 | Dao 独立不绑定 Google |

---

## 七、版本规划

### V0.1 — 核心可用

- [ ] `agent()` API + Agent Loop
- [ ] `tool()` API（单对象写法 + 自动转 JSON Schema）
- [ ] 模型层（DeepSeek / OpenAI / Gemini）
- [ ] 流式输出

### V0.5 — 流程控制

- [ ] `steps` 引擎（parallel / if / retry）
- [ ] `rules`（focus / reject）
- [ ] `memory: true` 基础记忆
- [ ] `wait` 步骤 + `resume()` API

### V1.0 — 完整能力

- [ ] `team()` API + 单 Agent 调度
- [ ] 插件系统（hooks）
- [ ] 文档（中文先行，后续补充英文）

### 不做（后续版本）

- [ ] MCP 协议支持
- [ ] 高级 Memory（向量存储、RAG）
- [ ] Observability 插件
- [ ] Time Travel
- [ ] 沙箱 / UI / 通信协议

---

## 八、项目结构

```
dao/
├── src/
│   ├── index.ts          # 入口，导出 agent / team / tool
│   ├── agent.ts          # agent() 实现
│   ├── team.ts           # team() 实现
│   ├── tool.ts           # tool() + 简写参数转 JSON Schema
│   ├── loop.ts           # Agent Loop 核心循环
│   ├── engine.ts         # Steps 引擎
│   ├── rules.ts          # Rules 权限判断
│   ├── memory.ts         # Memory 基础实现
│   ├── model.ts          # 模型层（Vercel AI SDK 封装）
│   ├── plugin.ts         # 插件系统
│   └── types.ts          # 类型定义
├── plugins/
│   └── logger.ts         # 内置 logger 插件
├── tools/
│   ├── fs.ts             # 文件操作工具
│   └── shell.ts          # 命令行工具
├── docs/                 # 中文文档
├── examples/             # 示例项目
├── package.json
└── tsconfig.json
```

---

## 九、验证方案

1. **API 验证**：用 6 个 Demo 场景验证 API 是否好用
   - 最简聊天 / 文件助手 / 代码审查 / 多 Agent / 审批流程 / Agent 嵌套
2. **引擎验证**：单元测试覆盖 steps 引擎所有分支
3. **端到端验证**：用 Dao 搭建一个真实的代码助手，验证生产可用性
