# 多模态输入

Dao 支持通过 `MessageInput` 类型传入文本、图片、文件的混合内容。

## 基本用法

```typescript
import { agent } from "dao-ai"

const bot = agent({ model: "google/gemini-2.0-flash" })

// 纯文本（向后兼容）
await bot.chat("你好")

// 多模态：文本 + 图片
await bot.chat([
  { type: "text", text: "这张图里有什么？" },
  { type: "image", image: "https://example.com/photo.jpg" },
])
```

## 支持的内容类型

### TextPart

```typescript
{ type: "text", text: "你的文本" }
```

### ImagePart

```typescript
// URL
{ type: "image", image: "https://example.com/image.png" }

// Base64
{ type: "image", image: "data:image/png;base64,iVBOR..." }
```

### FilePart

```typescript
{ type: "file", data: "https://example.com/report.pdf", mediaType: "application/pdf" }
```

## 适用的方法

所有 Agent 方法都支持 `MessageInput`：

```typescript
// chat
await bot.chat([...parts])

// run
const result = await bot.run([...parts])

// chatStream
for await (const chunk of bot.chatStream([...parts])) {
  process.stdout.write(chunk)
}

// runStream
for await (const event of bot.runStream([...parts])) { ... }
```

## 记忆存储

当 `memory: true` 时，多模态内容会被完整存储在对话历史中，下一轮对话可以引用之前发送的图片。

## 模型兼容性

| 模型 | 图片 | 文件 |
|------|------|------|
| Gemini | ✅ | ✅ |
| GPT-4o | ✅ | ✅ |
| Claude | ✅ | ✅ |
| DeepSeek | ❌ | ❌ |

> 使用多模态时请确保选用支持的模型，否则 API 会返回错误。
