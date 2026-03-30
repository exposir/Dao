/**
 * 代码生成 Agent 示例
 *
 * 根据自然语言需求生成完整代码文件，支持多语言，先解析需求再生成。
 *
 * 运行：npx tsx examples/code-generator.ts
 */

import "dotenv/config"
import { agent, tool } from "dao-ai"
import { readFile, writeFile, listDir } from "dao-ai/tools"
import { resolve } from "node:path"

// 工具：列出目录结构
const listSrc = tool({
  name: "listSrc",
  description: "列出 src 目录下的所有文件",
  params: {},
  run: async () => {
    const { listDir } = await import("dao-ai/tools")
    return await listDir.run({ dir: "src", recursive: true })
  },
})

// 工具：生成代码文件
const writeCode = tool({
  name: "writeCode",
  description: "写入代码文件到指定路径",
  params: {
    path: { type: "string", description: "文件路径，相对于项目根目录" },
    code: { type: "string", description: "要写入的代码内容" },
  },
  run: async ({ path, code }) => {
    const fs = await import("node:fs/promises")
    const fullPath = resolve(process.cwd(), path)
    await fs.mkdir(resolve(fullPath, ".."), { recursive: true })
    await fs.writeFile(fullPath, code, "utf-8")
    return `✅ 已写入：${path}`
  },
})

// 工具：检查代码语法（简单 Node.js parse）
const checkSyntax = tool({
  name: "checkSyntax",
  description: "检查 JavaScript/TypeScript 代码语法是否正确",
  params: { code: { type: "string", description: "代码内容" } },
  run: async ({ code }) => {
    try {
      new Function(code)
      return "✅ 语法正确"
    } catch (e: any) {
      return `❌ 语法错误：${e.message}`
    }
  },
})

const generator = agent({
  role: "代码生成专家",
  goal: "根据需求生成高质量、可直接运行的代码",
  background: [
    "你擅长 TypeScript / Node.js，精通函数式和面向对象设计",
    "你生成的代码风格一致：类型完备、注释简洁、无冗余",
    "你会先用 checkSyntax 验证语法，再告知用户完成",
  ].join("。"),
  model: "deepseek/deepseek-chat",
  tools: [readFile, writeCode, checkSyntax, listSrc],
  rules: {
    focus: ["类型安全", "错误处理", "代码可读性"],
    reject: ["不要生成任何敏感信息", "不要执行危险操作"],
  },
  maxTurns: 15,
})

async function main() {
  const spec = process.argv.slice(2).join(" ") ||
    "写一个 TypeScript 函数，接收一个数字数组，返回中位数。要求：类型完备、处理空数组、导出为 ESM"

  console.log("📋 需求：", spec)
  console.log("\n⏳ 生成中...\n")

  const result = await generator.run(
    `请为以下需求生成代码：\n\n${spec}\n\n` +
    "步骤要求：\n" +
    "1. 先用 listSrc 了解项目结构\n" +
    "2. 用 writeCode 写入 src/utils/median.ts\n" +
    "3. 用 checkSyntax 验证语法\n" +
    "4. 读取生成的文件，确认内容后报告完成"
  )

  console.log(result.output)
  console.log(`\n耗时: ${result.duration}ms | tokens: ${result.usage.totalTokens}`)
}

main().catch(console.error)
