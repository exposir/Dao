# 自定义工具

Dao 的工具系统核心是 `tool()` 工厂函数。不需要 Zod，不需要 Schema 定义——参数只用字符串描述。

## 基础结构

```typescript
import { tool } from "dao-ai"

const myTool = tool({
  name: "toolName",          // 工具唯一标识，LLM 通过这个名字调用
  description: "做什么的",    // 描述越清楚，LLM 越知道什么时候调用
  params: {                   // 参数定义 — 键是参数名，值是描述文本
    input: "输入内容",
  },
  run: async ({ input }) => { // 实际执行逻辑
    return `处理结果: ${input}`
  },
})
```

## 参数类型

params 的值可以是字符串（自动推断为 `type: "string"`），也可以手动指定类型：

```typescript
const searchTool = tool({
  name: "search",
  description: "搜索网络内容",
  params: {
    query: "搜索关键词",           // 字符串（默认）
    limit: "最多返回结果数",       // 数字
    type: {                       // 枚举/可选值
      type: "string",
      enum: ["web", "news", "image"],
    },
  },
  run: ({ query, limit, type }) => {
    // ...
  },
})
```

params 会自动转为 JSON Schema 传给模型。无需手写 schema。

## async / sync

工具函数可以是同步或异步：

```typescript
// 同步工具
const addNumbers = tool({
  name: "addNumbers",
  params: { a: "第一个数", b: "第二个数" },
  run: ({ a, b }) => a + b,          // 同步
})

// 异步工具（HTTP 请求、数据库查询等）
const fetchUrl = tool({
  name: "fetchUrl",
  params: { url: "目标 URL" },
  run: async ({ url }) => {            // 异步
    const res = await fetch(url)
    return res.text()
  },
})
```

## 危险操作需要确认

`confirm: true` 会在执行前触发 `onConfirm` 回调：

```typescript
const deleteFile = tool({
  name: "deleteFile",
  description: "删除文件",
  params: { path: "文件路径" },
  confirm: true,       // 执行前必须确认
  run: ({ path }) => {
    fs.unlinkSync(path)
    return `已删除 ${path}`
  },
})

// 在 agent 中注册回调
const bot = agent({
  tools: [deleteFile],
  onConfirm: async (toolName, params) => {
    return await ask(`确认执行 ${toolName}(${params.path})？`)
  },
})
```

## 工具错误处理

工具内部抛出错误会作为工具执行失败处理，Agent Loop 可以重试：

```typescript
const fragileTool = tool({
  name: "fragileTool",
  params: {},
  run: () => {
    if (Math.random() < 0.5) throw new Error("随机失败")
    return "成功"
  },
})

const bot = agent({
  tools: [fragileTool],
  retry: { maxRetries: 3 },   // 失败时自动重试 3 次
})
```

## 返回值规范

工具返回值会自动转为字符串传给 LLM。建议：

```typescript
// ✅ 好：结构化返回，LLM 容易解析
return JSON.stringify({ status: "ok", count: 3 })

// ✅ 好：纯文本，适合简单结果
return `找到 3 个结果：\n1. 文件 A\n2. 文件 B\n3. 文件 C`

// ⚠️ 注意：不要返回过大的内容（LLM context 有限）
// 如果需要返回大量数据，先摘要再返回
```

## 内置工具

Dao 默认提供 7 个常用工具，通过 `dao-ai/tools` 引入：

```typescript
import {
  readFile,    // 读文件
  writeFile,   // 写文件
  deleteFile,  // 删文件（confirm: true）
  listDir,     // 列目录
  runCommand,  // 执行 shell 命令
  search,      // 网络搜索
  fetchUrl,    // HTTP GET
} from "dao-ai/tools"

const coder = agent({
  tools: [readFile, writeFile, listDir, runCommand],
})
```

## 接入外部服务

工具是接入外部系统的桥梁。以下是几个常见场景：

**向量数据库（RAG）**：

```typescript
const vectorSearch = tool({
  name: "vectorSearch",
  params: { query: "用户查询" },
  run: async ({ query }) => {
    const embedding = await embed(query)
    const results = await vectorDb.query(embedding, { topK: 5 })
    return results.map(r => r.text).join("\n---\n")
  },
})
```

**GitHub API**：

```typescript
const fetchPR = tool({
  name: "fetchPR",
  params: { url: "GitHub PR URL" },
  run: async ({ url }) => {
    const res = await fetch(`https://api.github.com${url}`, {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
    })
    return JSON.stringify(await res.json())
  },
})
```

## 下一步

- [工具 API 参考](/api#tool) — 完整的参数类型定义
- [Agent Loop](/agent-loop) — 工具如何被调用、执行循环如何工作
- [插件系统](/guide/plugins) — 在工具执行前后注入逻辑
