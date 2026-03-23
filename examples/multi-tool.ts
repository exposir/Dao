/**
 * 道（Dao）— 多工具协作示例
 * 
 * 演示：多个工具协作 + temperature 控制
 * 运行：npx tsx examples/multi-tool.ts
 */

import "dotenv/config"
import { agent, tool } from "dao-ai"
import fs from "fs"

// 工具：获取当前时间
const getCurrentTime = tool({
  name: "getCurrentTime",
  description: "获取当前的日期和时间",
  params: {},
  run: () => new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
})

// 工具：读取文件
const readFile = tool({
  name: "readFile",
  description: "读取文件内容",
  params: { path: "文件路径" },
  run: ({ path: filePath }) => {
    try {
      return fs.readFileSync(filePath, "utf-8")
    } catch {
      return `错误：文件 ${filePath} 不存在`
    }
  },
})

// 工具：写入文件
const writeFile = tool({
  name: "writeFile",
  description: "将内容写入文件",
  params: { path: "文件路径", content: "文件内容" },
  run: ({ path: filePath, content }) => {
    fs.writeFileSync(filePath, content, "utf-8")
    return `已写入 ${filePath}（${content.length} 字符）`
  },
})

// 工具：计算
const calculate = tool({
  name: "calculate",
  description: "计算数学表达式",
  params: { expression: "数学表达式，如 2+3*4" },
  run: ({ expression }) => {
    try {
      // 安全计算：只允许数字和运算符
      if (!/^[\d\s+\-*/().]+$/.test(expression)) {
        return "错误：表达式包含非法字符"
      }
      return String(Function(`"use strict"; return (${expression})`)())
    } catch {
      return "错误：无法计算"
    }
  },
})

async function main() {
  const assistant = agent({
    role: "全能助手",
    model: "deepseek/deepseek-chat",
    tools: [getCurrentTime, readFile, writeFile, calculate],
    temperature: 0.3,
  })

  console.log("=== 多工具协作 ===\n")

  // 任务：组合使用多个工具
  const result = await assistant.run(
    "请完成以下任务：\n" +
    "1. 获取当前时间\n" +
    "2. 读取 package.json 文件，告诉我项目名称和版本\n" +
    "3. 计算 2024 * 365\n" +
    "最后汇总所有结果。"
  )

  console.log("结果：")
  console.log(result.output)
  console.log(`\n耗时: ${result.duration}ms | tokens: ${result.usage.totalTokens}`)
  console.log(`轮次: ${result.turns.length}`)
}

main().catch(console.error)
