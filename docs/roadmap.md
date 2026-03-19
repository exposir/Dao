# Dao 开发路线图

## 里程碑总览

```
V0.1 核心可用        V0.5 流程控制        V1.0 完整能力
────────────────    ────────────────    ────────────────
bot.chat("你好")    steps 引擎          team() 多 Agent
能跑通              能跑通              能跑通
```

---

## V0.1 — 核心可用

> 目标：`agent()` + `tool()` + Agent Loop + 模型层，能跑通 `bot.chat("你好")`

### 第 1 步：类型定义

| 文件 | 内容 |
|---|---|
| `src/types.ts` | AgentOptions, ToolOptions, ToolInstance, ParamsDef, ParamSpec, RunResult, RunEvent, StepContext, HookContext, PluginOptions 等全部类型 |

### 第 2 步：工具系统

| 文件 | 内容 |
|---|---|
| `src/tool.ts` | `tool()` 函数：接收 ToolOptions，paramsToJsonSchema 转换，返回 ToolInstance |

验证：`tool({ name, description, params, run })` 能正确生成 JSON Schema。

### 第 3 步：模型层

| 文件 | 内容 |
|---|---|
| `src/model.ts` | resolveModel()：解析 `"provider/model"` 字符串，读取环境变量，创建模型实例 |

验证：`resolveModel("deepseek/deepseek-chat")` 返回可用的 LanguageModel。

### 第 4 步：Agent Loop

| 文件 | 内容 |
|---|---|
| `src/loop.ts` | 核心 while 循环：组装 messages → 调用模型 → 处理响应（文本/工具调用）→ 检查终止条件 → Grace Period |

验证：能和模型对话，能调用工具，能在 maxTurns 时停止。

### 第 5 步：agent() 入口

| 文件 | 内容 |
|---|---|
| `src/agent.ts` | `agent()` 函数：接收 AgentOptions，组装 system prompt，创建 AgentInstance（chat / run / chatStream / runStream / clearMemory） |

验证：完整跑通以下代码：

```typescript
import { agent, tool } from "dao"

const readFile = tool({
  name: "readFile",
  description: "读取文件",
  params: { path: "文件路径" },
  run: ({ path }) => fs.readFileSync(path, "utf-8"),
})

const bot = agent({
  role: "文件助手",
  model: "deepseek/deepseek-chat",
  tools: [readFile],
})

await bot.chat("读一下 package.json 的内容")
```

### 第 6 步：索引 + 构建

| 文件 | 内容 |
|---|---|
| `src/index.ts` | 导出 agent, tool, configure |
| `tsconfig.json` | TypeScript 配置 |
| `package.json` | 补充 dependencies（ai, @ai-sdk/deepseek 等） |

### V0.1 交付物

- [ ] `bot.chat("你好")` 能收到模型回复
- [ ] `bot.chat("读一下 package.json")` 能调用工具并返回结果
- [ ] `memory: true` 时多轮对话保持上下文
- [ ] `bot.run("任务")` 能自主循环直到完成或 maxTurns
- [ ] stream 模式能逐字输出

---

## V0.5 — 流程控制

> 目标：steps 引擎 + rules + memory，能跑通步骤流程

### 第 7 步：Rules 系统

| 文件 | 内容 |
|---|---|
| `src/rules.ts` | 将 rules.focus / rules.reject 注入到 system prompt |

### 第 8 步：Steps 引擎

| 文件 | 内容 |
|---|---|
| `src/engine.ts` | 步骤执行器：字符串步骤、parallel（Promise.allSettled）、if/then/else（LLM 判断 + 函数判断）、retry、函数步骤 |

### 第 9 步：wait + resume

| 文件 | 内容 |
|---|---|
| `src/engine.ts` | WaitStep：状态序列化 + SuspendEvent + resume() |
| `src/agent.ts` | AgentInstance 添加 resume() 方法 |

### V0.5 交付物

- [ ] 步骤列表能按顺序执行
- [ ] parallel 能并行执行
- [ ] if/then/else 能根据条件分支
- [ ] retry 能重试失败步骤
- [ ] rules.reject 能阻止 LLM 做被禁止的事
- [ ] wait 能暂停并恢复

---

## V1.0 — 完整能力

> 目标：team() + plugins，完整框架

### 第 10 步：插件系统

| 文件 | 内容 |
|---|---|
| `src/plugin.ts` | plugin() 函数、hook 注册和执行、全局插件 |
| `plugins/logger.ts` | 内置 logger 插件 |

### 第 11 步：team() 系统

| 文件 | 内容 |
|---|---|
| `src/team.ts` | team() 函数、auto lead 生成、delegate 工具注入 |

### 第 12 步：内置工具

| 文件 | 内容 |
|---|---|
| `tools/fs.ts` | readFile, writeFile, listDir |
| `tools/shell.ts` | runCommand, search |

### V1.0 交付物

- [ ] 插件 hooks 正常触发
- [ ] team() 能调度多个 Agent
- [ ] 内置工具可用
- [ ] 完整文档（中文 + 英文）

---

## 开发顺序

```
types.ts → tool.ts → model.ts → loop.ts → agent.ts → index.ts
   1          2          3          4          5          6
                        V0.1
                    ─────────────────

rules.ts → engine.ts → wait/resume
   7          8            9
              V0.5
          ─────────────

plugin.ts → team.ts → tools/
   10         11        12
              V1.0
          ─────────────
```

依赖关系：每一步只依赖前面的步骤，不存在循环依赖。
