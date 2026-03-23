/**
 * 道（Dao）— 集成测试脚本
 * 
 * 运行：npx tsx examples/hello.ts
 */

import "dotenv/config"
import { agent, tool } from "dao-ai"

// 1. 最简用法：纯聊天
async function testChat() {
  console.log("=== 测试 1：纯聊天 ===\n")

  const bot = agent({ model: "deepseek/deepseek-chat" })
  const reply = await bot.chat("用一句话介绍你自己")
  console.log("回复:", reply)
  console.log()
}

// 2. 带工具的 Agent
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

// 3. 带记忆的多轮对话
async function testMemory() {
  console.log("=== 测试 3：多轮对话 ===\n")

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

// 4. 流式输出
async function testStream() {
  console.log("=== 测试 4：流式输出 ===\n")

  const bot = agent({ model: "deepseek/deepseek-chat" })

  process.stdout.write("回复: ")
  for await (const chunk of bot.chatStream("用三句话介绍 TypeScript")) {
    process.stdout.write(chunk)
  }
  console.log("\n")
}

// 运行所有测试
async function main() {
  try {
    await testChat()
    await testToolCall()
    await testMemory()
    await testStream()
    console.log("✅ 全部测试通过")
  } catch (err) {
    console.error("❌ 测试失败:", err)
  }
}

main()
