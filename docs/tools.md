# 工具系统设计文档

---

## 1. 两种定义方式

### 1.1 普通函数（推荐）

```typescript
/**
 * 读取文件内容
 * @param path 文件路径
 * @returns 文件内容
 */
function readFile(path: string): string {
  return fs.readFileSync(path, "utf-8")
}

const bot = agent({ tools: [readFile] })
```

### 1.2 tool() 显式定义

```typescript
const readFile = tool({
  name: "readFile",
  description: "读取文件内容",
  params: { path: String },
  run: ({ path }) => fs.readFileSync(path, "utf-8"),
  confirm: true,
})
```

---

## 2. 自动推导机制

### 推导流程

```
普通函数传入 tools
  │
  ├─ 提取函数名 → name
  ├─ 提取 JSDoc 注释 → description
  ├─ 提取 TypeScript 参数类型 → params schema
  └─ 函数本身 → run
```

### 类型映射

| TypeScript 类型 | JSON Schema 类型 |
|---|---|
| `string` | `{ type: "string" }` |
| `number` | `{ type: "number" }` |
| `boolean` | `{ type: "boolean" }` |
| `string[]` | `{ type: "array", items: { type: "string" } }` |
| `{ key: type }` | `{ type: "object", properties: {...} }` |
| `key?: type` | 非 required |

### 实现方案

**V1 方案**：使用 TypeScript Compiler API 在构建时提取类型信息，生成 schema 文件。

**备选方案**：运行时使用 `Function.toString()` + 正则提取参数名，配合 JSDoc 注释。

```typescript
// 构建时生成的 schema（示意）
const readFileSchema = {
  name: "readFile",
  description: "读取文件内容",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "文件路径" }
    },
    required: ["path"]
  }
}
```

---

## 3. 工具注册表

```typescript
class ToolRegistry {
  private tools: Map<string, ToolInstance> = new Map()

  /** 注册工具 */
  register(tool: Function | ToolInstance): void {
    if (typeof tool === "function") {
      const resolved = inferToolSchema(tool)
      this.tools.set(resolved.name, resolved)
    } else {
      this.tools.set(tool.name, tool)
    }
  }

  /** 查找工具 */
  get(name: string): ToolInstance | undefined {
    return this.tools.get(name)
  }

  /** 生成 Vercel AI SDK 格式的 tools 对象 */
  toAISDKTools(): Record<string, CoreTool> {
    const result: Record<string, CoreTool> = {}
    for (const [name, tool] of this.tools) {
      result[name] = {
        description: tool.description,
        parameters: tool.schema,
        execute: tool.execute,
      }
    }
    return result
  }
}
```

---

## 4. 工具执行安全

### rules.reject 拦截

```typescript
async function executeToolSafely(
  toolName: string,
  params: any,
  rules: Rules,
  registry: ToolRegistry,
): Promise<ToolResult> {
  // 1. 查找工具
  const tool = registry.get(toolName)
  if (!tool) {
    return { error: `工具 "${toolName}" 不存在` }
  }

  // 2. rules.reject 检查
  if (rules.reject?.length) {
    const description = `${toolName}(${JSON.stringify(params)})`
    // 简单字符串匹配 + LLM 判断
    for (const rule of rules.reject) {
      if (matchesRejectRule(description, rule)) {
        return { error: `操作被拒绝：${rule}` }
      }
    }
  }

  // 3. confirm 检查
  if (tool.confirm) {
    const confirmed = await requestUserConfirmation(toolName, params)
    if (!confirmed) {
      return { error: "用户拒绝了该操作" }
    }
  }

  // 4. 执行
  try {
    const result = await tool.execute(params)
    return { data: result }
  } catch (error) {
    return { error: error.message }
  }
}
```

### reject 规则匹配

```typescript
function matchesRejectRule(action: string, rule: string): boolean {
  // 简单匹配：关键词包含
  const keywords = rule.toLowerCase().split(/\s+/)
  const actionLower = action.toLowerCase()
  return keywords.some(kw => actionLower.includes(kw))
}
```

> 后续版本可升级为 LLM 判断或 glob 模式匹配。

---

## 5. 内置工具

Dao 提供常用工具，通过 `dao/tools` 导入：

```typescript
import { readFile, writeFile, listDir, runCommand, search } from "dao/tools"
```

| 工具 | 描述 | confirm 默认值 |
|---|---|---|
| `readFile` | 读取文件 | false |
| `writeFile` | 写入文件 | true |
| `listDir` | 列出目录 | false |
| `runCommand` | 执行命令 | true |
| `search` | 搜索文件内容 | false |
