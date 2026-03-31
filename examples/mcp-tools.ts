/**
 * 道（Dao）— MCP 工具接入示例
 *
 * 演示两种接入方式：
 *   1. 内置 Mock MCP Server（完整 MCP 协议实现，本示例自包含）
 *   2. 连接真实 MCP Server（需要 @modelcontextprotocol/server-* 包）
 *
 * MCP（Model Context Protocol）是一种标准化协议，让 AI Agent
 * 可以调用任何实现了 MCP 的外部工具服务。
 *
 * 运行：
 *   npx tsx examples/mcp-tools.ts              # 使用内置 Mock Server（默认，无需额外依赖）
 *   npx tsx examples/mcp-tools.ts --mock        # 同上，显式指定
 *   npx tsx examples/mcp-tools.ts --url <url>  # 连接真实 MCP Server URL
 *
 * Mock Server 提供的工具：
 *   - get_weather(city)        获取城市天气
 *   - search_web(query)        模拟网络搜索
 *   - get_news(category)       获取新闻摘要
 */

import "dotenv/config"
import http from "node:http"
import { agent, mcpTools } from "dao-ai"

// ============================================================
// Mock MCP Server（完整 MCP over SSE 协议实现）
// 无需安装任何外部 MCP 包，本示例完全自包含
// ============================================================

/**
 * MCP Server 返回的工具定义（JSON Schema 格式）
 */
const mockTools = [
  {
    name: "get_weather",
    description: "获取指定城市的实时天气信息",
    inputSchema: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "城市名称，如「北京」「Shanghai」",
        },
      },
      required: ["city"],
    },
  },
  {
    name: "search_web",
    description: "模拟网络搜索，返回相关结果摘要",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜索关键词" },
        limit: {
          type: "number",
          description: "返回结果数量，默认 5",
          default: 5,
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_news",
    description: "获取指定类别的最新新闻摘要",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["tech", "sports", "entertainment", "finance"],
          description: "新闻类别",
        },
      },
      required: ["category"],
    },
  },
]

/** 模拟工具执行 */
function executeTool(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "get_weather": {
      const city = args.city as string
      const weathers: Record<string, string> = {
        北京: "🌤️  北京：晴，22°C，湿度 45%",
        上海: "🌧️  上海：小雨，18°C，湿度 80%",
        深圳: "☀️  深圳：晴，28°C，湿度 60%",
        东京: "🌤️  东京：多云，20°C，湿度 55%",
        纽约: "🌧️  纽约：小雨，15°C，湿度 70%",
      }
      return weathers[city] ?? `🌡️  ${city}：温度 ${Math.floor(Math.random() * 30 + 5)}°C`
    }
    case "search_web": {
      const query = args.query as string
      const limit = (args.limit as number) ?? 5
      return [
        `🔍 搜索结果（"${query}"，共 ${limit} 条）：`,
        `  1. 【${query}】完整指南 — 关于 ${query} 的全面介绍...`,
        `  2. ${query} 最新动态 — 2024 年发展趋势分析...`,
        `  3. ${query} 入门教程 — 从零开始掌握 ${query}...`,
        `  4. ${query} 最佳实践 — 10 个常用技巧分享...`,
        `  5. ${query} 社区讨论 — 开发者们都在聊什么...`,
      ].join("\n")
    }
    case "get_news": {
      const category = args.category as string
      const news: Record<string, string[]> = {
        tech: [
          "🚀 AI 模型迎来重大更新，推理速度提升 3 倍",
          "💻 TypeScript 5.6 发布，新增类型推断增强",
          "🌐 WebGPU 正式支持移动端，图形性能大幅提升",
        ],
        sports: [
          "⚽ 世界杯预选赛精彩回顾：阿根廷 3-1 巴西",
          "🏀 NBA 总决赛：湖人 vs 勇士，詹姆斯砍下三双",
          "🎾 中国网球公开赛：郑钦文晋级决赛",
        ],
        entertainment: [
          "🎬 《流浪地球3》定档春节，刘慈欣担任编剧",
          "🎵 周杰伦新专辑发布，首周销量破百万",
          "🎮 《黑神话：悟空》获年度最佳游戏提名",
        ],
        finance: [
          "📈 A股三大指数集体上涨，沪指重回 3400 点",
          "💰 比特币突破 10 万美元关口，创历史新高",
          "🏦 美联储宣布降息 25 个基点",
        ],
      }
      const items = news[category] ?? news.tech
      return "📰 " + items.join("\n📰 ")
    }
    default:
      throw new Error(`未知工具：${name}`)
  }
}

/**
 * Mock MCP Server（基于 SSE 协议）
 *
 * MCP 协议要点：
 *   - Server 通过 SSE（text/event-stream）推送工具列表
 *   - Client 通过 POST /mcp 发送 JSON-RPC 请求
 *   - 协议支持 tools/list 和 tools/call 两个核心方法
 */
function createMockMcpServer(port: number): http.Server {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`)

    // CORS 预检
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Last-Event-ID",
      })
      res.end()
      return
    }

    // 1. GET /sse — SSE 端点，Server 推送工具列表
    if (req.method === "GET" && url.pathname === "/sse") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      })

      // MCP 协议：先推送 endpoint 端点信息
      res.write(`event: endpoint\ndata: /mcp\n\n`)

      // 推送空消息保活
      res.write(`: connected\n\n`)

      // 保持连接活跃
      const keepAlive = setInterval(() => {
        if (res.writable) res.write(`: keepalive\n\n`)
      }, 15000)

      req.on("close", () => {
        clearInterval(keepAlive)
      })
      return
    }

    // 2. POST /mcp — JSON-RPC 端点
    if (req.method === "POST" && url.pathname === "/mcp") {
      let body = ""
      for await (const chunk of req) {
        body += chunk
      }

      let rpc: { id: unknown; method: string; params?: Record<string, unknown> }
      try {
        rpc = JSON.parse(body)
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ jsonrpc: "2.0", error: "Invalid JSON", id: null }))
        return
      }

      const { id, method, params = {} } = rpc
      let result: unknown

      try {
        if (method === "tools/list") {
          // 返回工具列表（JSON Schema 格式）
          result = { tools: mockTools }
        } else if (method === "tools/call") {
          // 执行工具
          const { name, arguments: args = {} } = params as {
            name: string
            arguments: Record<string, unknown>
          }
          const output = executeTool(name, args)
          result = { content: [{ type: "text", text: output }] }
        } else {
          throw new Error(`不支持的方法：${method}`)
        }
      } catch (err: any) {
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id,
            error: { code: -32603, message: err.message },
          })
        )
        return
      }

      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ jsonrpc: "2.0", id, result }))
      return
    }

    // 3. GET / — 健康检查 + API 说明
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(
        JSON.stringify({
          service: "Mock MCP Server",
          version: "1.0.0",
          endpoints: {
            sse: "GET /sse",
            rpc: "POST /mcp",
          },
          tools: mockTools.map(t => t.name),
        })
      )
      return
    }

    res.writeHead(404)
    res.end("Not Found")
  })

  return server
}

// ============================================================
// CLI 参数解析
// ============================================================

function parseArgs(): { url: string | null; mock: boolean } {
  const args = process.argv.slice(2)

  if (args[0] === "--help" || args[0] === "-h") {
    printHelp()
    process.exit(0)
  }

  if (args[0] === "--mock" || args[0] === "-m") {
    return { url: null, mock: true }
  }

  if (args[0] === "--url" && args[1]) {
    return { url: args[1], mock: false }
  }

  // 默认使用内置 Mock Server
  return { url: null, mock: true }
}

function printHelp() {
  console.log(`
MCP 工具接入示例 — 支持 Mock Server 和真实 MCP Server

用法：
  npx tsx examples/mcp-tools.ts [选项]

选项：
  --mock              使用内置 Mock MCP Server（默认，无需额外依赖）
  --url <MCP Server>  连接真实 MCP Server URL
  --help, -h          显示此帮助信息

Mock Server 提供的工具：
  - get_weather(city)       获取城市天气
  - search_web(query)       模拟网络搜索
  - get_news(category)      获取新闻摘要（tech/sports/entertainment/finance）

连接真实 MCP Server 示例：
  # 文件系统 MCP Server
  npx tsx examples/mcp-tools.ts --url http://localhost:3100/sse

  # 其他 MCP Server
  npx tsx examples/mcp-tools.ts --url http://your-mcp-server:port/sse
`)
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  const { url: mcpUrl, mock } = parseArgs()

  console.log("========================================")
  console.log("  Dao — MCP 工具接入示例")
  console.log("========================================\n")

  let server: http.Server | null = null
  let finalUrl: string

  if (mock) {
    // 启动内置 Mock MCP Server
    const port = 3100
    server = createMockMcpServer(port)
    await new Promise<void>(resolve => server!.listen(port, resolve))
    finalUrl = `http://localhost:${port}/sse`
    console.log(`✅ Mock MCP Server 已启动：${finalUrl}\n`)
  } else {
    finalUrl = mcpUrl!
    console.log(`🔗 连接到外部 MCP Server：${finalUrl}\n`)
  }

  try {
    // 通过 mcpTools 加载 MCP 工具
    console.log("⏳ 正在加载 MCP 工具...\n")
    const tools = await mcpTools({ url: finalUrl })

    console.log(`✅ 成功加载 ${tools.length} 个 MCP 工具：`)
    tools.forEach(t => console.log(`  ✅ ${t.name}`))
    console.log()

    // 创建 Agent
    const bot = agent({
      model: "deepseek/deepseek-chat",
      tools,
    })

    // 演示任务
    const task = process.argv.includes("--task")
      ? process.argv.slice(process.argv.indexOf("--task") + 1).join(" ")
      : [
          "请依次完成以下任务：",
          "1. 查询北京和上海的天气",
          "2. 搜索'TypeScript AI Agent'相关新闻",
          "3. 获取最新科技新闻",
        ].join("\n")

    console.log("📋 任务：")
    console.log(task)
    console.log("\n⏳ 执行中...\n")

    const result = await bot.run(task)

    console.log("--- 结果 ---\n")
    console.log(result.output)
    console.log(`\n⏱️  耗时: ${result.duration}ms | tokens: ${result.usage.totalTokens}`)
    console.log(`🔖 requestId: ${result.requestId}`)
  } catch (err: any) {
    console.error(`\n❌ 运行失败：${err.message}\n`)
    if (err.message?.includes("fetch")) {
      console.error("   提示：请确保 MCP Server 已启动（Mock 模式无需手动启动）\n")
    }
    if (mock) {
      console.error(`   Mock Server 地址：${finalUrl}\n`)
    }
    process.exit(1)
  } finally {
    server?.close()
  }
}

main()
