# Dao（道）— 大道至简的 AI Agent 框架

## 一、项目定位

**Dao** 是一个中文优先、渐进式的 TypeScript AI Agent 框架。

> **一句话定位：Agent 领域的 Vue。**

```typescript
import { agent } from "dao"

const bot = agent({ model: "deepseek/deepseek-chat" })
await bot.chat("你好")
```

### 目标用户

- 中国 TypeScript / 前端开发者
- 想用 AI Agent 但被 Mastra / LangChain 吓退的人
- 想从简单场景起步、逐步构建复杂应用的团队

### 解决的问题

| 痛点 | Dao 的解法 |
|---|---|
| Mastra 太重（28 个包，agent.ts 5375 行） | 核心精简，一个包搞定 |
| Vercel AI SDK 太薄（没有 Loop/Memory/权限） | 内置 Agent Loop、权限、策略 |
| 没有中文优先的 TS Agent 框架 | 第一个 |
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
  tools: [readFile, listDir],
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

### 2.3 中文优先

- **中文文档**：所有文档中文优先
- **API 望文生义**：`tools`、`steps`、`rules`——前端开发者全认识
- **开箱即用**：默认配置就够用，不需要先搞懂 10 个概念

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
  tools: [readFile, writeFile],    // 可用工具（普通函数 or tool()）

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

### 3.2 team() — 创建团队

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

> **架构说明**：`team()` 底层是单 Agent 架构——lead 做决策，members 被调用。但开发者看到的是"团队协作"。

### 3.3 tool() — 自定义工具

```typescript
// 方式一：直接传普通函数（自动推导 schema）
function readFile(path: string): string {
  return fs.readFileSync(path, "utf-8")
}

const bot = agent({ tools: [readFile] })

// 方式二：需要更多控制时用 tool()
import { tool } from "dao"

const readFile = tool({
  name: "readFile",
  description: "读取文件内容",
  params: { path: String },
  run: ({ path }) => fs.readFileSync(path, "utf-8"),
  confirm: true,  // 执行前需要用户确认
})
```

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
    { wait: "请审查文章内容" },
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
| `{ parallel: [...] }` | 并行任务 | `Promise.all()` |
| `{ if, then, else }` | 条件分支 | LLM 判断（字符串）或 代码判断（函数） |
| `{ retry: N }` | 重试 | do-while 循环 |
| `{ wait: "..." }` | 暂停等待 | suspend → 序列化状态 → 等待恢复 |
| `(ctx) => ...` | 自定义函数 | 直接执行 |

> **设计原则**：90% 场景用声明式步骤，10% 复杂场景混入函数。

### 4.3 工具系统

```
普通函数 → 
  TypeScript 类型提取 → 
    自动生成 JSON Schema → 
      注册到 Agent → 
        模型调用时匹配并执行
```

### 4.4 模型层

基于 Vercel AI SDK，统一 `provider/model` 格式：

```typescript
model: "deepseek/deepseek-chat"    // DeepSeek
model: "openai/gpt-4o"             // OpenAI
model: "google/gemini-2.5-pro"     // Gemini
```

通过 `.env` 文件配置 API Key：

```env
DEEPSEEK_API_KEY=sk-xxx
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

const logger = plugin({
  name: "logger",
  hooks: {
    beforeModelCall: (ctx) => { console.log("调用模型:", ctx.prompt) },
    afterToolCall: (ctx) => { console.log("工具结果:", ctx.result) },
    onError: (ctx) => { console.error("出错:", ctx.error) },
  },
})

// 使用
const bot = agent({ plugins: [logger] })
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

1. **唯一中文优先的 TS Agent 框架** — 搜遍全网无竞品
2. **唯一行为描述式 API**（role/tools/steps/rules）
3. **步骤列表替代流程图** — LLM 做决策，开发者给方向
4. **`rules.reject` 内置权限** — 其他框架均无

### 6.3 最接近的竞品分析

| 框架 | 相似点 | Dao 的优势 |
|---|---|---|
| **VoltAgent** | 声明式、TS 原生、可观测性 | Dao 有 steps 引擎、rules 权限、中文生态 |
| **easy-agent** | 极简、轻量 | Dao 有 team、steps、memory，能力完整 |
| **KaibanJS** | 角色定义、多 Agent | Dao 用声明式步骤，KaibanJS 用看板管理 |
| **PraisonAI** | 多 Agent、低代码 | Dao 是 TS 原生，PraisonAI 从 Python 移植 |
| **Strands SDK** | 简单几行代码 | Dao 独立不绑定 AWS |
| **Google ADK** | 代码优先、模块化 | Dao 独立不绑定 Google |

---

## 七、V1 范围

### 做

- [ ] `agent()` API + Agent Loop
- [ ] `team()` API + 单 Agent 调度
- [ ] `tool()` API + 普通函数自动推导
- [ ] `steps` 引擎（parallel / if / retry / wait）
- [ ] `rules`（focus / reject）
- [ ] `memory: true` 基础记忆
- [ ] 多模型支持（DeepSeek / OpenAI / Gemini）
- [ ] 流式输出（默认开启）
- [ ] 插件系统（hooks）
- [ ] 中文文档

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
│   ├── tool.ts           # tool() + 函数自动推导
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
