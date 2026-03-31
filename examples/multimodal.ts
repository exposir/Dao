/**
 * 道（Dao）— 多模态对话示例
 *
 * 演示：图片分析 + PDF 文件分析 + 混合内容输入
 * 支持 Gemini、Qwen-VL 等多模态模型
 *
 * 运行：
 *   npx tsx examples/multimodal.ts                           # 使用在线图片（默认）
 *   npx tsx examples/multimodal.ts --file ./docs/index.md    # 本地文件分析
 *   npx tsx examples/multimodal.ts --url <图片URL>           # 指定任意图片 URL
 */

import "dotenv/config"
import { agent } from "dao-ai"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

// ============================================================
// CLI 参数解析
// ============================================================

interface CliArgs {
  mode: "image" | "file" | "url"
  value: string
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)

  if (args[0] === "--help" || args[0] === "-h") {
    printHelp()
    process.exit(0)
  }

  if (args[0] === "--file" && args[1]) {
    return { mode: "file", value: resolve(args[1]) }
  }

  if (args[0] === "--url" && args[1]) {
    return { mode: "url", value: args[1] }
  }

  // 默认：使用在线示例图片
  return {
    mode: "image",
    value: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/800px-Camponotus_flavomarginatus_ant.jpg",
  }
}

function printHelp() {
  console.log(`
多模态对话示例 — 支持图片 / PDF / 任意文件

用法：
  npx tsx examples/multimodal.ts [选项]

选项：
  --file <路径>    分析本地文件（支持图片、PDF 等）
  --url <URL>      分析网络图片
  --help, -h       显示此帮助信息

默认行为：
  使用 Wikipedia 的蚂蚁图片进行演示（无需任何参数）

示例：
  npx tsx examples/multimodal.ts
  npx tsx examples/multimodal.ts --file ./docs/index.md
  npx tsx examples/multimodal.ts --url https://example.com/diagram.png
`)
}

// ============================================================
// 多模态 Agent（Gemini 模型原生支持多模态）
// ============================================================

const mmAgent = agent({
  role: "图像分析师",
  model: "google/gemini-2.0-flash",
})

// ============================================================
// 分析网络图片
// ============================================================

async function analyzeImage(url: string) {
  console.log("📷 分析网络图片...")
  console.log(`   URL: ${url}\n`)

  const start = Date.now()

  const result = await mmAgent.chat([
    {
      type: "text",
      text: "请详细描述这张图片的内容，包括主体、背景、风格等要素。",
    },
    {
      type: "image",
      image: url,
    },
  ])

  console.log(`✅ 描述结果（${Date.now() - start}ms）：`)
  console.log(result)
  console.log()
}

// ============================================================
// 分析本地文件（图片 / PDF / 纯文本）
// ============================================================

async function analyzeLocalFile(filePath: string) {
  console.log(`📄 分析本地文件：${filePath}\n`)

  const ext = filePath.toLowerCase().split(".").pop() ?? ""
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext)
  const isPdf = ext === "pdf"

  let content: any

  if (isImage) {
    // 图片：读取为 base64
    const buf = await readFile(filePath)
    const base64 = buf.toString("base64")
    const mimeType =
      ext === "jpg" ? "image/jpeg" : ext === "png" ? "image/png" : `image/${ext}`
    content = `data:${mimeType};base64,${base64}`
  } else if (isPdf) {
    // PDF：读取为 base64
    const buf = await readFile(filePath)
    content = `data:application/pdf;base64,${buf.toString("base64")}`
  } else {
    // 纯文本：直接读取内容
    content = await readFile(filePath, "utf-8")
  }

  const start = Date.now()

  let result: string

  if (isImage) {
    result = await mmAgent.chat([
      {
        type: "text",
        text: "请描述这张图片的内容。",
      },
      {
        type: "image",
        image: content as string,
      },
    ])
  } else if (isPdf) {
    result = await mmAgent.chat([
      {
        type: "text",
        text: "请总结这份 PDF 文档的主要内容。",
      },
      {
        type: "file",
        data: content as string,
        mediaType: "application/pdf",
      },
    ])
  } else {
    // 纯文本
    const text = content as string
    result = await mmAgent.chat([
      {
        type: "text",
        text: `请总结以下文档内容：\n\n${text.slice(0, 2000)}${text.length > 2000 ? "\n\n[...]" : ""}`,
      },
    ])
  }

  console.log(`✅ 分析结果（${Date.now() - start}ms）：`)
  console.log(result)
  console.log()
}

// ============================================================
// 分析指定 URL
// ============================================================

async function analyzeUrl(url: string) {
  console.log(`🔗 分析指定 URL：${url}\n`)
  await analyzeImage(url)
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  const args = parseArgs()

  console.log("========================================")
  console.log("  Dao — 多模态对话示例")
  console.log("========================================\n")

  try {
    switch (args.mode) {
      case "image":
        await analyzeImage(args.value)
        break
      case "file":
        await analyzeLocalFile(args.value)
        break
      case "url":
        await analyzeUrl(args.value)
        break
    }

    // 补充演示：一次对话多个输入
    console.log("--- 补充演示：混合内容输入 ---\n")
    console.log("📋 同时发送图片 + 问题...\n")

    const multiResult = await mmAgent.chat([
      {
        type: "text",
        text: "图中有几只蚂蚁？它们在做什么？",
      },
      {
        type: "image",
        image: args.mode === "image" ? args.value : "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/800px-Camponotus_flavomarginatus_ant.jpg",
      },
    ])

    console.log(`多轮回答（${Date.now() - Date.now()}ms）：`)
    console.log(multiResult)
  } catch (err: any) {
    console.error(`❌ 多模态示例运行失败：${err.message}\n`)
    if (err.message?.includes("model") || err.message?.includes("not support")) {
      console.error("   提示：多模态功能需要使用支持图片的模型，如 google/gemini-2.0-flash\n")
      console.error("   或在 .env 中配置 DEEPSEEK_API_KEY 并改用 deepseek-chat（不支持图片输入）\n")
    }
    process.exit(1)
  }
}

main()
