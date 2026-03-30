/**
 * 自动化测试生成示例
 *
 * 输入一个文件或函数描述，自动生成测试用例（Vitest 格式）。
 *
 * 运行：npx tsx examples/auto-test.ts
 */

import "dotenv/config"
import { agent, tool } from "dao-ai"
import { readFile } from "dao-ai/tools"
import { resolve, dirname } from "node:path"
import { mkdir, writeFile } from "node:fs/promises"

// 工具：读取源代码
const readCode = tool({
  name: "readCode",
  description: "读取源代码文件内容",
  params: { path: { type: "string", description: "文件路径" } },
  run: async ({ path }) => {
    try {
      return await readFile.run(resolve(process.cwd(), path))
    } catch {
      return `无法读取：${path}`
    }
  },
})

// 工具：写测试文件
const writeTest = tool({
  name: "writeTest",
  description: "写入测试文件到 tests 目录",
  params: {
    path: { type: "string", description: "测试文件路径" },
    content: { type: "string", description: "测试代码内容" },
  },
  run: async ({ path, content }) => {
    const fullPath = resolve(process.cwd(), path)
    await mkdir(dirname(fullPath), { recursive: true })
    await writeFile(fullPath, content, "utf-8")
    return `✅ 测试文件已写入：${path}`
  },
})

// 工具：验证测试文件语法
const validateTests = tool({
  name: "validateTests",
  description: "验证测试文件语法是否正确",
  params: { content: { type: "string", description: "测试代码内容" } },
  run: ({ content }) => {
    try {
      new Function(content.replace(/import .+ from .+/g, ""))
      return "✅ 语法正确"
    } catch (e: any) {
      return `❌ 语法错误：${e.message}`
    }
  },
})

const testBot = agent({
  role: "测试工程师",
  goal: "分析源代码，生成覆盖全面、边界条件完整的测试用例",
  background: [
    "你使用 Vitest 风格编写测试：describe / it / expect",
    "你会分析源码逻辑，找出所有分支和边界条件",
    "你会覆盖：正常路径、边界值、空输入、异常输入",
    "测试文件名规范：<源文件>.test.ts，置于 tests/ 目录",
  ].join("。"),
  model: "deepseek/deepseek-chat",
  tools: [readCode, writeTest, validateTests],
  rules: {
    focus: ["边界条件", "异常处理", "真实断言值"],
    reject: ["不要写无意义的占位测试", "不要省略断言"],
  },
  maxTurns: 12,
})

async function main() {
  const targetFile = process.argv[2] || "src/utils/median.ts"

  console.log("🎯 目标文件：", targetFile)
  console.log("\n⏳ 分析中...\n")

  const result = await testBot.run(
    `请为以下源文件生成测试用例：\n\n${targetFile}\n\n` +
    "步骤要求：\n" +
    "1. 用 readCode 读取源代码，分析函数签名和逻辑\n" +
    "2. 用 validateTests 验证生成的测试语法\n" +
    "3. 用 writeTest 写入 tests/ 目录，路径为 <原文件名>.test.ts\n" +
    "4. 报告生成结果"
  )

  console.log(result.output)
  console.log(`\n耗时: ${result.duration}ms | tokens: ${result.usage.totalTokens}`)

  // 尝试运行测试（如果有 vitest）
  try {
    const { execSync } = await import("node:child_process")
    console.log("\n尝试运行测试...")
    execSync(`npx vitest run --reporter=verbose ${targetFile.replace("src/", "tests/").replace(".ts", ".test.ts")} 2>&1`, {
      cwd: process.cwd(),
      stdio: "inherit",
    })
  } catch {
    // 忽略错误（可能没装 vitest 或文件不存在）
  }
}

main().catch(console.error)
