# 工具系统设计文档

---

## 1. 工具定义

Dao 统一使用 `tool()` 函数定义工具，传入一个对象。

### 基础用法

```typescript
import { tool } from "dao-ai"

const readFile = tool({
  name: "readFile",
  description: "读取文件内容",
  params: { path: "文件路径" },
  run: ({ path }) => fs.readFileSync(path, "utf-8"),
})

const search = tool({
  name: "search",
  description: "搜索文件内容",
  params: { query: "搜索关键词", dir: "搜索目录" },
  run: ({ query, dir }) => grep(query, dir),
})
```

参数值是字符串时，默认类型为 `string`。

### 需要用户确认

```typescript
const writeFile = tool({
  name: "writeFile",
  description: "写入文件",
  params: { path: "文件路径", content: "文件内容" },
  run: ({ path, content }) => fs.writeFileSync(path, content),
  confirm: true,
})
```

### 非 string 类型

```typescript
const deleteFiles = tool({
  name: "deleteFiles",
  description: "批量删除文件",
  params: {
    paths: { type: "array", description: "文件路径列表" },
    force: { type: "boolean", description: "是否强制" },
  },
  run: ({ paths, force }) => ...,
})
```

---

## 2. 参数转换机制

### 简写 → JSON Schema

框架内部自动将简写参数转为 JSON Schema，通过 Vercel AI SDK 的 `jsonSchema()` 传给模型：

```typescript
// 用户写的
{ path: "文件路径", content: "文件内容" }

// 框架自动转为
{
  type: "object",
  properties: {
    path: { type: "string", description: "文件路径" },
    content: { type: "string", description: "文件内容" },
  },
  required: ["path", "content"]
}
```

### 转换规则

| 用户写法 | 转换结果 |
|---|---|
| `"描述"` | `{ type: "string", description: "描述" }` + required |
| `{ type: "number", description: "..." }` | 原样保留 + required |
| `{ type: "boolean", description: "...", optional: true }` | 原样保留 + 不加 required |
| `{ type: "array", description: "...", items: { type: "string" } }` | 原样保留 |

### 实现

```typescript
function paramsToJsonSchema(params: ParamsDef): JSONSchema {
  const properties: Record<string, any> = {}
  const required: string[] = []

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      // 简写：字符串描述 → string 类型
      properties[key] = { type: "string", description: value }
      required.push(key)
    } else {
      // 完整：对象定义
      properties[key] = {
        type: value.type,
        description: value.description,
        ...(value.items && { items: value.items }),
      }
      if (!value.optional) required.push(key)
    }
  }

  return { type: "object", properties, required }
}
```

> **不依赖 Zod。** 用户不需要安装 Zod，不需要写 `z.object()`。

---

## 3. 工具执行安全

### rules.reject

`rules.reject` 通过 **prompt 注入** 实现——将禁止行为写入 system prompt，让 LLM 自行遵守：

```typescript
// rules.reject 注入到 system prompt
if (rules.reject?.length) {
  systemPrompt += `\n\n你绝对不能做以下事情：\n${rules.reject.map(r => `- ${r}`).join("\n")}`
}
```

> 不做硬拦截。LLM 负责判断什么工具调用违反了 reject 规则。后续版本可增加工具级精确拦截。

### confirm 确认

工具设置 `confirm: true` 后，执行前会调用 `agent({ onConfirm })` 回调让用户确认：

```typescript
// 1. 工具标记 confirm
const writeFile = tool({
  name: "writeFile",
  confirm: true,
  ...
})

// 2. agent 提供确认回调
const bot = agent({
  tools: [writeFile],
  onConfirm: async (toolName, params) => {
    return await askUser(`允许执行 ${toolName}？`)
  },
})
```

如果用户拒绝，工具返回“被用户拒绝执行”给 LLM，LLM 自行决定后续操作。

> **注意**：如果工具标记了 `confirm: true` 但 agent 未配置 `onConfirm` 回调，框架会**直接抛错**而不是静默跳过确认。这是安全设计——确保危险工具不会在没有审批机制的情况下被执行。

---

## 4. 内置工具

```typescript
import { readFile, writeFile, listDir, runCommand, search } from "dao-ai/tools"
```

| 工具 | 描述 | confirm |
|---|---|---|
| `readFile` | 读取文件 | false |
| `writeFile` | 写入文件 | false |
| `listDir` | 列出目录 | false |
| `runCommand` | 执行命令 | false |
| `search` | 搜索文件内容 | false |

> 内置工具默认不开启 confirm。高风险操作建议通过 `onConfirm` 回调或插件的 `beforeToolCall` + `skip()` 实现审批。
