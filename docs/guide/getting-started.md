# 快速上手

这页只做一件事：让你从空目录出发，5 分钟跑通第一个 Dao Agent。

## 1. 初始化项目

```bash
mkdir my-agent
cd my-agent
npm init -y
npm install dao-ai dotenv
npm install -D tsx typescript
```

## 2. 配置环境变量

Dao 使用 `provider/model` 格式指定模型。先在项目根目录创建 `.env`：

```env
DEEPSEEK_API_KEY=your_key
```

如果你用的是其他 provider，改成对应的 API Key 即可。详细格式见 [模型配置](/model)。

## 3. 写第一个 Agent

创建 `index.ts`：

```typescript
import "dotenv/config"
import { agent } from "dao-ai"

const bot = agent({ model: "deepseek/deepseek-chat" })
console.log(await bot.chat("你好"))
```

## 4. 运行

```bash
npx tsx index.ts
```

如果一切正常，你会在终端看到模型返回的文本。

## 5. 记住这个最小骨架

平时你真正需要记住的只有这几行：

```typescript
import { agent } from "dao-ai"

const bot = agent({ model: "deepseek/deepseek-chat" })
await bot.chat("你好")
```

其它像 `.env`、`tsx`、依赖安装，都是项目初始化时做一次。

接下来你可以按需求继续加能力，先别一次性全开：

## 带工具的 Agent

```typescript
import { agent, tool } from "dao-ai"

const getCurrentTime = tool({
  name: "getCurrentTime",
  description: "获取当前时间",
  params: {},
  run: () => new Date().toLocaleString("zh-CN"),
})

const bot = agent({
  model: "deepseek/deepseek-chat",
  tools: [getCurrentTime],
})

await bot.chat("现在几点了？")
```

## 带角色和规则

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

## 多轮对话

开启 `memory` 即可支持上下文记忆：

```typescript
const bot = agent({
  model: "deepseek/deepseek-chat",
  memory: true,
})

await bot.chat("我叫小明")
await bot.chat("我叫什么名字？") // 能记住你叫小明
```

## 流式输出

```typescript
const bot = agent({ model: "deepseek/deepseek-chat" })

for await (const chunk of bot.chatStream("介绍 TypeScript")) {
  process.stdout.write(chunk)
}
```

## 内置工具

Dao 提供开箱即用的常用工具：

```typescript
import { agent } from "dao-ai"
import { readFile, writeFile, deleteFile, listDir, runCommand, search, fetchUrl } from "dao-ai/tools"

const coder = agent({
  role: "开发者",
  tools: [readFile, writeFile, deleteFile, listDir, runCommand, search, fetchUrl],
})

await coder.run("读取 package.json 并告诉我项目名称")
```

## 插件系统

通过插件扩展 Agent 能力。内置 `logger` 插件打印执行日志：

```typescript
import { agent, logger } from "dao-ai"

const bot = agent({
  model: "deepseek/deepseek-chat",
  plugins: [logger()],
})

await bot.chat("你好") // 控制台会打印执行日志
```

自定义插件：

```typescript
import { plugin } from "dao-ai"

const timer = plugin({
  name: "timer",
  hooks: {
    beforeModelCall: () => console.time("模型调用"),
    afterModelCall: () => console.timeEnd("模型调用"),
  },
})
```

## 多 Agent 协作

```typescript
import { agent, team } from "dao-ai"
import { readFile, writeFile, runCommand } from "dao-ai/tools"

const planner = agent({ role: "架构师", tools: [readFile] })
const coder = agent({ role: "开发者", tools: [readFile, writeFile] })
const tester = agent({ role: "测试工程师", tools: [runCommand] })

const squad = team({
  members: { planner, coder, tester },
})

await squad.run("给项目添加用户登录功能")
```

## 容错配置

```typescript
const bot = agent({
  model: "deepseek/deepseek-chat",
  fallbackModel: "openai/gpt-4o",     // 主模型失败自动切换
  retry: { maxRetries: 3 },           // 自动重试
  timeout: 30000,                     // 30 秒超时
  maxTokens: 2000,                    // 限制输出长度
})
```

## 结构化输出 (V2.2)

如果需要模型返回严格符合类型定义的 JSON，可以使用 `generate()` 方法：

```typescript
import { z } from "zod"

const bot = agent({ model: "openai/gpt-4o" })

const result = await bot.generate("生成两个用户", {
  schema: z.object({
    users: z.array(z.object({
      name: z.string(),
      age: z.number(),
    }))
  })
})

console.log(result.object.users[0].name)
console.log(result.usage.totalTokens)
```

## 输出校验

```typescript
const bot = agent({
  steps: [
    {
      task: "生成 JSON 报告",
      output: "JSON 格式，包含 severity 和 message",
      validate: (r) => {
        try { JSON.parse(r); return true }
        catch { return "输出不是合法 JSON" }
      },
      maxRetries: 2,
    },
  ],
})
```

## 工具确认

```typescript
const bot = agent({
  tools: [
    tool({ name: "deleteFile", confirm: true, ... }),
  ],
  onConfirm: async (toolName, params) => {
    return await ask(`确认执行 ${toolName}？`)
  },
})
```

## 下一步

- [工具系统](/tools) — 学习如何定义自定义工具
- [Agent Loop](/agent-loop) — 了解核心执行循环
- [Steps 引擎](/engine) — 声明式工作流
- [插件系统](/plugins) — 扩展 Agent 能力
- [团队协作](/team) — 多 Agent 协同工作
- [API 文档](/api) — 完整的类型定义和参数说明
