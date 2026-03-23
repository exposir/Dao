/**
 * 多模态对话示例
 *
 * 演示如何使用图片和文件作为输入
 */

import { agent } from "dao-ai"

async function main() {
  const bot = agent({ model: "google/gemini-2.0-flash" })

  // 图片分析
  const answer = await bot.chat([
    { type: "text", text: "描述这张图片的内容" },
    { type: "image", image: "https://upload.wikimedia.org/wikipedia/commons/a/a7/Camponotus_flavomarginatus_ant.jpg" },
  ])
  console.log("图片分析:", answer)

  // 文件分析
  const analysis = await bot.chat([
    { type: "text", text: "总结这个文件的要点" },
    { type: "file", data: "https://example.com/report.pdf", mediaType: "application/pdf" },
  ])
  console.log("文件分析:", analysis)
}

main()
