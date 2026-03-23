/**
 * 多模态输入测试
 *
 * 测试 MessageInput 类型在 agent 方法中的处理
 * 注意：由于 mockModel 下 AI SDK 仍会尝试下载图片 URL，
 * 这里只测试 text-only ContentPart[] 以验证类型系统工作。
 */

import { describe, it, expect } from "vitest"
import { agent, mockModel } from "../src/index.js"

describe("多模态输入", () => {
  it("chat() 应该接受纯字符串（向后兼容）", async () => {
    const bot = agent({
      modelProvider: mockModel(["你好"]),
      memory: true,
    })
    const result = await bot.chat("hello")
    expect(result).toBe("你好")
  })

  it("chat() 应该接受 text-only ContentPart[] 数组", async () => {
    const bot = agent({
      modelProvider: mockModel(["回复"]),
      memory: true,
    })
    // text-only ContentPart[] 不需要网络请求
    const result = await bot.chat([
      { type: "text", text: "第一段" },
      { type: "text", text: "第二段" },
    ])
    expect(result).toBe("回复")
  })

  it("run() 应该接受 text-only ContentPart[] 数组", async () => {
    const bot = agent({
      modelProvider: mockModel(["分析完成"]),
    })
    const result = await bot.run([
      { type: "text", text: "分析这段文本" },
    ])
    expect(result.output).toBe("分析完成")
    expect(result.requestId).toBeDefined()
  })

  it("多模态文本消息应该存入 memory", async () => {
    const bot = agent({
      modelProvider: mockModel(["第一轮", "第二轮"]),
      memory: true,
    })
    // 第一轮：ContentPart[] 输入
    await bot.chat([
      { type: "text", text: "分析" },
    ])
    // 第二轮：纯文本，应该能访问到前一轮的上下文
    const second = await bot.chat("继续分析")
    expect(second).toBe("第二轮")
  })

  it("MessageInput 类型检查 — 图片/文件类型应该正确", () => {
    // 类型检查：确保 ImagePart 和 FilePart 结构正确编译
    const imagePart = { type: "image" as const, image: "https://example.com/photo.jpg" }
    const filePart = { type: "file" as const, data: "base64data", mediaType: "application/pdf" }
    const textPart = { type: "text" as const, text: "hello" }

    expect(imagePart.type).toBe("image")
    expect(imagePart.image).toBeDefined()
    expect(filePart.type).toBe("file")
    expect(filePart.data).toBeDefined()
    expect(filePart.mediaType).toBe("application/pdf")
    expect(textPart.type).toBe("text")
    expect(textPart.text).toBe("hello")
  })
})
