/**
 * 道（Dao）— 代码审查 Agent 示例
 * 
 * 演示：role + tools + rules 配合使用
 * 运行：npx tsx examples/code-reviewer.ts
 */

import "dotenv/config"
import { agent, tool } from "../src/index.js"
import fs from "fs"
import path from "path"

// 工具：读取文件
const readFile = tool({
  name: "readFile",
  description: "读取指定路径的文件内容",
  params: { path: "文件的绝对或相对路径" },
  run: ({ path: filePath }) => {
    try {
      return fs.readFileSync(filePath, "utf-8")
    } catch {
      return `错误：无法读取文件 ${filePath}`
    }
  },
})

// 工具：列出目录
const listDir = tool({
  name: "listDir",
  description: "列出指定目录下的文件和子目录",
  params: { dir: "目录路径" },
  run: ({ dir }) => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      return entries
        .map(e => `${e.isDirectory() ? "📁" : "📄"} ${e.name}`)
        .join("\n")
    } catch {
      return `错误：无法读取目录 ${dir}`
    }
  },
})

async function main() {
  const reviewer = agent({
    role: "代码审查员",
    model: "deepseek/deepseek-chat",
    tools: [readFile, listDir],
    rules: {
      focus: ["代码质量", "潜在 bug", "可读性"],
      reject: ["修改代码", "删除文件"],
    },
  })

  // 审查当前项目的 src/tool.ts
  const result = await reviewer.run(
    "请审查 src/tool.ts 这个文件，给出改进建议。先读取文件内容，然后分析。"
  )

  console.log("审查结果：")
  console.log(result.output)
  console.log(`\n耗时: ${result.duration}ms | tokens: ${result.usage.totalTokens}`)
}

main().catch(console.error)
