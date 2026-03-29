/**
 * 道（Dao）— 代码审查 Agent 示例
 *
 * 演示：role + tools + rules 配合使用
 * 运行：npx tsx examples/code-reviewer.ts
 */

import "dotenv/config"
import { agent } from "dao-ai"
import { readFile, listDir } from "dao-ai/tools"

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
