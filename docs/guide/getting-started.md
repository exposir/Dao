# 快速开始

## 安装

```bash
npm install dao
```

## 最简用法

3 行代码，创建你的第一个 Agent：

```typescript
import { agent } from "dao"

const bot = agent({ model: "deepseek/deepseek-chat" })
await bot.chat("你好")
```

## 配置模型

Dao 使用 `provider/model` 格式指定模型。在项目根目录创建 `.env` 文件：

```env
# 选择你使用的模型，设置对应的 API Key
DEEPSEEK_API_KEY=sk-xxx
```

支持的模型和详细配置见 [模型配置](/model)。

## 带工具的 Agent

```typescript
import { agent, tool } from "dao"

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

## 下一步

- [工具系统](/tools) — 学习如何定义自定义工具
- [Agent Loop](/agent-loop) — 了解核心执行循环
- [API 文档](/api) — 完整的类型定义和参数说明
