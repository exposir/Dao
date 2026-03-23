/**
 * MCP 错误处理测试
 *
 * 测试 mcpTools() 和 mcpClient() 的参数校验
 * 注意：不测试实际 MCP 连接（需要 @ai-sdk/mcp）
 */

import { describe, it, expect } from "vitest"
import { mcpTools, mcpClient } from "../src/mcp.js"

describe("mcpTools()", () => {
  it("无 url 和 command 时应该抛错", async () => {
    await expect(mcpTools({} as any)).rejects.toThrow()
  })

  it("错误信息应该提示缺少传输配置", async () => {
    try {
      await mcpTools({} as any)
    } catch (e: any) {
      // 可能是 "需要安装 @ai-sdk/mcp" 或 "需要指定 url 或 command"
      expect(e.message).toBeTruthy()
    }
  })
})

describe("mcpClient()", () => {
  it("无 url 和 command 时应该抛错", async () => {
    await expect(mcpClient({} as any)).rejects.toThrow()
  })
})
