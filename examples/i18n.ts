/**
 * 国际化示例
 *
 * 演示如何切换框架语言
 */

import { agent, setLocale, configure } from "dao-ai"

// 切换到英文模式 — 所有内置错误信息和提示将使用英文
setLocale("en")

async function main() {
  // 故意不指定模型，触发英文错误信息
  try {
    const bot = agent({})
    await bot.chat("hello")
  } catch (e: any) {
    console.log("English error:", e.message)
    // 输出: "No model specified. Use agent({ model: \"provider/model\" })..."
  }

  // 切回中文
  setLocale("zh")

  try {
    const bot = agent({})
    await bot.chat("你好")
  } catch (e: any) {
    console.log("中文错误:", e.message)
    // 输出: "未指定模型。请通过 agent({ model: \"provider/model\" })..."
  }
}

main()
