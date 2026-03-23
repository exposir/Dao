/**
 * 道（Dao）— MCP 协议支持
 *
 * 通过 @ai-sdk/mcp 桥接 MCP server 的 tools，
 * 自动转换为 Dao 的 ToolInstance[] 格式。
 *
 * 需要安装可选依赖：npm install @ai-sdk/mcp
 */

import type { ToolInstance, JSONSchema } from "./core/types.js"

/** MCP 连接配置 */
export interface MCPOptions {
  /** HTTP/SSE 模式的 URL */
  url?: string
  /** Stdio 模式的命令 */
  command?: string
  /** Stdio 模式的参数 */
  args?: string[]
  /** Stdio 模式的环境变量 */
  env?: Record<string, string>
  /** 传输类型，默认自动推断 */
  transport?: "sse" | "stdio"
}

/**
 * 连接 MCP server 并返回 Dao ToolInstance[]
 *
 * @example
 * ```typescript
 * const tools = await mcpTools({
 *   url: "http://localhost:3100/sse",
 * })
 * const bot = agent({ tools })
 * ```
 */
export async function mcpTools(options: MCPOptions): Promise<ToolInstance[]> {
  // 动态导入 @ai-sdk/mcp，它是可选依赖
  let createMCPClient: any
  try {
    // @ts-ignore — @ai-sdk/mcp 是可选依赖，运行时动态加载
    const mod = await import("@ai-sdk/mcp")
    createMCPClient = mod.createMCPClient
  } catch {
    throw new Error(
      "使用 mcpTools() 需要安装 @ai-sdk/mcp：npm install @ai-sdk/mcp"
    )
  }

  // 根据配置创建 transport
  let transport: any
  if (options.url) {
    // SSE 传输
    transport = {
      type: "sse",
      url: options.url,
    }
  } else if (options.command) {
    // Stdio 传输
    transport = {
      type: "stdio",
      command: options.command,
      args: options.args ?? [],
      env: options.env,
    }
  } else {
    throw new Error("mcpTools() 需要指定 url（SSE 模式）或 command（Stdio 模式）")
  }

  // 创建 MCP client，获取 tools
  const client = await createMCPClient({ transport })

  try {
    const mcpToolSet = await client.tools()
    const toolNames = Object.keys(mcpToolSet)

    // 将 MCP tools 转换为 Dao ToolInstance[]
    const daoTools: ToolInstance[] = toolNames.map(name => {
      const mcpTool = mcpToolSet[name]

      // 提取 JSON Schema
      const schema: JSONSchema = {
        type: "object",
        properties: mcpTool.parameters?.properties ?? {},
        required: mcpTool.parameters?.required ?? [],
      }

      return {
        __type: "tool" as const,
        name,
        description: mcpTool.description ?? name,
        schema,
        confirm: false,
        execute: async (params: any) => {
          // 调用 MCP tool 的 execute 方法
          const result = await mcpTool.execute(params)
          return result
        },
      }
    })

    return daoTools
  } catch (err) {
    await client.close?.()
    throw err
  }
}

/**
 * 创建 MCP client 并返回 tools + close 函数
 * 用于需要在结束时关闭连接的场景
 */
export async function mcpClient(options: MCPOptions): Promise<{
  tools: ToolInstance[]
  close: () => Promise<void>
}> {
  // 动态导入 @ai-sdk/mcp
  let createMCPClient: any
  try {
    // @ts-ignore — @ai-sdk/mcp 是可选依赖，运行时动态加载
    const mod = await import("@ai-sdk/mcp")
    createMCPClient = mod.createMCPClient
  } catch {
    throw new Error(
      "使用 mcpClient() 需要安装 @ai-sdk/mcp：npm install @ai-sdk/mcp"
    )
  }

  let transport: any
  if (options.url) {
    transport = { type: "sse", url: options.url }
  } else if (options.command) {
    transport = {
      type: "stdio",
      command: options.command,
      args: options.args ?? [],
      env: options.env,
    }
  } else {
    throw new Error("mcpClient() 需要指定 url 或 command")
  }

  const client = await createMCPClient({ transport })
  const mcpToolSet = await client.tools()
  const toolNames = Object.keys(mcpToolSet)

  const daoTools: ToolInstance[] = toolNames.map(name => {
    const mcpTool = mcpToolSet[name]
    return {
      __type: "tool" as const,
      name,
      description: mcpTool.description ?? name,
      schema: {
        type: "object" as const,
        properties: mcpTool.parameters?.properties ?? {},
        required: mcpTool.parameters?.required ?? [],
      },
      confirm: false,
      execute: async (params: any) => mcpTool.execute(params),
    }
  })

  return {
    tools: daoTools,
    close: async () => client.close?.(),
  }
}
