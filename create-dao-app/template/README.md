# {{name}}

基于 [Dao 框架](https://github.com/exposir/Dao) 的 AI 助手。

## 快速开始

```bash
npm install
cp .env.example .env     # 填入你的 API Key
npm run dev             # 启动交互式对话
```

## 项目结构

```
src/
├── index.ts   # 入口：REPL + 命令行模式
├── agent.ts   # Agent 配置：身份、工具、规则
└── tools.ts   # 自定义工具
```

## 使用方式

```bash
# 交互式对话（REPL）
npm run dev

# 单次问答
npx tsx src/index.ts "什么是 TypeScript？"

# 流式输出
npx tsx src/index.ts --stream "写一个快速排序"

# 帮助
npx tsx src/index.ts --help
```

## REPL 内置命令

| 命令 | 说明 |
|------|------|
| `exit` | 退出 |
| `clear` | 清屏 |
| `help` | 帮助 |
| `token` | 查看 token 用量 |
| `reset` | 重置对话记忆 |

## 自定义助手

编辑 `src/agent.ts`：

```typescript
const MY_ASSISTANT = agent({
  role: "你的助手身份",
  goal: "助手的目标",
  model: "deepseek/deepseek-chat",
  tools: [readFile, listDir, webSearch, calculator],
  memory: true,
  rules: { focus: [...], reject: [...] },
})
```

添加新工具，编辑 `src/tools.ts`，然后在 `agent.ts` 中引入。

## 模型配置

`.env` 中配置 API Key（按需取消注释）：

```bash
DEEPSEEK_API_KEY=sk-xxx
OPENAI_API_KEY=sk-xxx
GOOGLE_API_KEY=xxx
```

## 下一步

参考 [Dao 示例](https://github.com/exposir/Dao/tree/main/examples)：
- `npx tsx ../examples/pr-reviewer.ts` — PR 自动审查
- `npx tsx ../examples/db-query.ts` — 自然语言 SQL
- `npx tsx ../examples/team.ts` — 多 Agent 协作
