/**
 * 道（Dao）— 集成测试脚本
 *
 * 演示 Dao 框架的核心功能：聊天、工具调用、记忆、流式输出
 *
 * 运行：
 *   npx tsx examples/hello.ts           # 运行全部测试（默认）
 *   npx tsx examples/hello.ts --chat    # 仅聊天
 *   npx tsx examples/hello.ts --tool    # 仅工具调用
 *   npx tsx examples/hello.ts --memory  # 仅多轮对话
 *   npx tsx examples/hello.ts --stream  # 仅流式输出
 */

import "dotenv/config"
import { agent, tool } from "dao-ai"

// ============================================================
// CLI 参数解析
// ============================================================

type Mode = "all" | "chat" | "tool" | "memory" | "stream"

function parseArgs(): Mode {
  const args = process.argv.slice(2)
  if (args[0] === "--help" || args[0] === "-h") {
    printHelp()
    process.exit(0)
  }
  const modeMap: Record<string, Mode> = {
    "--chat": "chat",
    "--tool": "tool",
    "--memory": "memory",
    "--stream": "stream",
  }
  for (const [flag, mode] of Object.entries(modeMap)) {
    if (args.includes(flag)) return mode
  }
  return "all"
}

function printHelp() {
  console.log(`
Dao 框架快速体验 — 5 分钟了解核心功能

用法：
  npx tsx examples/hello.ts [选项]

选项：
  --chat    仅测试聊天功能
  --tool    仅测试工具调用
  --memory  仅测试多轮对话（记忆）
  --stream  仅测试流式输出
  --help    显示此帮助信息

默认行为：
  依次运行全部 4 个测试场景。
`)
}

// ============================================================
// 1. 最简用法：纯聊天
// ============================================================

async function testChat() {
  console.log("=== 测试 1：纯聊天 ===\n")

  const bot = agent({ model: "deepseek/deepseek-chat" })
  const reply = await bot.chat("用一句话介绍你自己")
  console.log("回复:", reply)
  console.log()
}

// ============================================================
// 2. 带工具的 Agent
// ============================================================

async function testToolCall() {
  console.log("=== 测试 2：带工具 ===\n")

  const getCurrentTime = tool({
    name: "getCurrentTime",
    description: "获取当前时间",
    params: { format: { type: "string", description: "时间格式", optional: true } },
    run: () => new Date().toLocaleString("zh-CN"),
  })

  const bot = agent({
    model: "deepseek/deepseek-chat",
    tools: [getCurrentTime],
  })

  const reply = await bot.chat("现在几点了？")
  console.log("回复:", reply)
  console.log()
}

// ============================================================
// 3. 带记忆的多轮对话
// ============================================================

async function testMemory() {
  console.log("=== 测试 3：多轮对话（记忆）===\n")

  const bot = agent({
    model: "deepseek/deepseek-chat",
    memory: true,
  })

  const r1 = await bot.chat("我叫小明")
  console.log("第 1 轮:", r1)

  const r2 = await bot.chat("我叫什么名字？")
  console.log("第 2 轮:", r2)
  console.log()
}

// ============================================================
// 4. 流式输出
// ============================================================

async function testStream() {
  console.log("=== 测试 4：流式输出 ===\n")

  const bot = agent({ model: "deepseek/deepseek-chat" })

  process.stdout.write("回复: ")
  for await (const chunk of bot.chatStream("用三句话介绍 TypeScript")) {
    process.stdout.write(chunk)
  }
  console.log("\n")
}

// ============================================================
// 运行所有测试
// ============================================================

async function main() {
  console.log("========================================")
  console.log("  Dao — 框架功能快速体验")
  console.log("========================================\n")

  const mode = parseArgs()

  const runners: Array<{ name: string; fn: () => Promise<void> }> = [
    { name: "聊天", fn: testChat },
    { name: "工具调用", fn: testToolCall },
    { name: "多轮对话", fn: testMemory },
    { name: "流式输出", fn: testStream },
  ]

  for (const runner of runners) {
    if (mode !== "all" && runner.name !== mode &&
        !(mode === "memory" && runner.name === "多轮对话") &&
        !(mode === "stream" && runner.name === "流式输出") &&
        !(mode === "chat" && runner.name === "聊天") &&
        !(mode === "tool" && runner.name === "工具调用")) {
      continue
    }
    try {
      await runner.fn()
    } catch (err) {
      console.error(`❌ ${runner.name} 测试失败：`, err)
    }
  }

  console.log("✅ 体验完成！")
  console.log("\n想深入了解？试试这些示例：")
  console.log("  npx tsx examples/code-reviewer.ts    # 代码审查")
  console.log("  npx tsx examples/db-query.ts         # 自然语言数据库查询")
  console.log("  npx tsx examples/pr-reviewer.ts       # GitHub PR 自动审查")
}

main()
