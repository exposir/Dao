/**
 * MCP 工具接入示例
 *
 * 演示如何通过 MCP 协议桥接外部工具
 * 需要安装：npm install @ai-sdk/mcp
 */

import { agent, mcpTools } from "dao-ai"

async function main() {
  // 通过 SSE 连接 MCP server
  const tools = await mcpTools({
    url: "http://localhost:3100/sse",
  })

  console.log(`已加载 ${tools.length} 个 MCP 工具:`)
  tools.forEach(t => console.log(`  - ${t.name}: ${t.description}`))

  const bot = agent({
    model: "deepseek/deepseek-chat",
    tools,
  })

  const result = await bot.run("列出当前目录下的所有文件")
  console.log(result.output)
  console.log(`requestId: ${result.requestId}`)
}

main()
