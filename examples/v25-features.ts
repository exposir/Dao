/**
 * V2.5 新功能示例
 *
 * 演示：onAsk（运行中提问）+ state（共享状态）+ plugin 可变性
 * 运行：npx tsx examples/v25-features.ts
 */

import "dotenv/config"
import { agent, plugin } from "dao-ai"
import * as readline from "readline/promises"

// ============================================================
// 1. onAsk — Agent 运行中主动向用户提问
// ============================================================

async function demoOnAsk() {
  console.log("=== onAsk 示例 ===\n")

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const bot = agent({
    model: "deepseek/deepseek-chat",
    role: "文件助手",
    onAsk: async (question) => {
      const answer = await rl.question(`🤖 Agent 提问: ${question}\n> `)
      return answer
    },
  })

  await bot.run("帮我创建一个新项目的目录结构")
  rl.close()
}

// ============================================================
// 2. state — 多次 run 之间共享状态
// ============================================================

async function demoState() {
  console.log("\n=== state 示例 ===\n")

  const bot = agent({ model: "deepseek/deepseek-chat" })

  // 初始化状态
  bot.state.set("taskCount", 0)
  bot.state.set("results", [])

  // 第一次 run
  const r1 = await bot.run("用一句话总结 TypeScript 的优点")
  bot.state.set("taskCount", bot.state.get("taskCount")! + 1)
  bot.state.get("results")!.push(r1.output)

  // 第二次 run — 状态保持
  const r2 = await bot.run("用一句话总结 Rust 的优点")
  bot.state.set("taskCount", bot.state.get("taskCount")! + 1)
  bot.state.get("results")!.push(r2.output)

  console.log(`完成 ${bot.state.get("taskCount")} 个任务`)
  console.log("所有结果:", bot.state.get("results"))
}

// ============================================================
// 3. Plugin 可变性 — beforeModelCall 修改 prompt
// ============================================================

async function demoPluginMutability() {
  console.log("\n=== Plugin 可变性示例 ===\n")

  // 创建一个 RAG 模拟插件：在每次模型调用前注入上下文
  const ragPlugin = plugin({
    name: "rag-simulator",
    hooks: {
      beforeModelCall: (ctx) => {
        // 修改 system prompt，注入检索到的参考资料
        ctx.systemPrompt += `\n\n参考资料：
- Dao 框架基于 Vercel AI SDK 构建
- 支持 DeepSeek、Qwen、Gemini、GPT 等模型
- 核心设计原则是"大道至简"`
        console.log("[RAG Plugin] 已注入参考资料到 system prompt")
      },
    },
  })

  const bot = agent({
    model: "deepseek/deepseek-chat",
    role: "文档助手",
    plugins: [ragPlugin],
  })

  const result = await bot.run("介绍一下 Dao 框架")
  console.log("回答:", result.output)
}

// ============================================================
// 运行所有示例
// ============================================================

async function main() {
  await demoState()
  await demoPluginMutability()
  // onAsk 需要交互，放最后
  // await demoOnAsk()
}

main().catch(console.error)
