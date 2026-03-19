/**
 * 道（Dao）— 翻译 Agent 示例
 * 
 * 演示：memory 多轮对话 + systemPrompt 自定义
 * 运行：npx tsx examples/translator.ts
 */

import "dotenv/config"
import { agent } from "../src/index.js"

async function main() {
  const translator = agent({
    role: "专业翻译",
    model: "deepseek/deepseek-chat",
    memory: true,
    systemPrompt: "你是一个专业翻译，擅长中英互译。翻译时保持原文风格，不添加解释。",
  })

  console.log("=== 翻译 Agent（多轮记忆）===\n")

  // 第 1 轮：翻译
  const r1 = await translator.chat("翻译成英文：大道至简")
  console.log("翻译:", r1)

  // 第 2 轮：追问（依赖记忆）
  const r2 = await translator.chat("把刚才的翻译改成更文学的风格")
  console.log("文学版:", r2)

  // 第 3 轮：反向翻译
  const r3 = await translator.chat("再把它翻译回中文")
  console.log("回译:", r3)

  console.log("\n=== 测试完成 ===")
}

main().catch(console.error)
