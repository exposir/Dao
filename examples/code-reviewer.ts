/**
 * 道（Dao）— 代码审查 Agent 示例
 *
 * 演示：role + tools + rules 配合使用
 *
 * 运行：
 *   npx tsx examples/code-reviewer.ts                       # 审查默认文件（src/tool.ts）
 *   npx tsx examples/code-reviewer.ts src/agent.ts          # 审查指定文件
 *   npx tsx examples/code-reviewer.ts src/ --recursive       # 递归审查目录
 */

import "dotenv/config"
import { agent } from "dao-ai"
import { readFile, listDir } from "dao-ai/tools"
import { resolve, isAbsolute } from "node:path"
import { stat } from "node:fs/promises"

// ============================================================
// CLI 参数解析
// ============================================================

interface CliArgs {
  target: string      // 文件或目录路径
  recursive: boolean
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)

  if (args[0] === "--help" || args[0] === "-h") {
    printHelp()
    process.exit(0)
  }

  let target = "src/tool.ts"
  let recursive = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--recursive" || args[i] === "-r") {
      recursive = true
    } else if (!args[i].startsWith("-")) {
      target = args[i]
    }
  }

  // 解析绝对路径
  if (!isAbsolute(target)) {
    target = resolve(process.cwd(), target)
  }

  return { target, recursive }
}

function printHelp() {
  console.log(`
代码审查示例 — 基于 Dao Agent 的自动化代码审查

用法：
  npx tsx examples/code-reviewer.ts [目标路径] [选项]

参数：
  目标路径      要审查的文件或目录路径（默认：src/tool.ts）

选项：
  --recursive, -r   递归审查目录下的所有 .ts 文件
  --help, -h        显示此帮助信息

示例：
  npx tsx examples/code-reviewer.ts
  npx tsx examples/code-reviewer.ts src/agent.ts
  npx tsx examples/code-reviewer.ts src/core/ --recursive
`)
}

// ============================================================
// 获取要审查的文件列表
// ============================================================

async function collectFiles(target: string, recursive: boolean): Promise<string[]> {
  try {
    const s = await stat(target)
    if (s.isFile()) {
      if (!target.endsWith(".ts") && !target.endsWith(".tsx")) {
        console.warn(`⚠️  跳过非 TypeScript 文件：${target}`)
        return []
      }
      return [target]
    }

    if (s.isDirectory()) {
      const listing = await listDir.run({ dir: target, recursive })
      // listDir 返回的是字符串格式，需要解析
      const lines = listing.split("\n").filter(l => l.trim())
      return lines
        .filter(l => l.endsWith(".ts") || l.endsWith(".tsx"))
        .map(l => {
          if (isAbsolute(l)) return l
          return resolve(target, l)
        })
    }
  } catch {
    console.error(`❌ 无法访问路径：${target}`)
  }
  return []
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  const { target, recursive } = parseArgs()

  console.log("========================================")
  console.log("  Dao — 代码审查示例")
  console.log("========================================\n")

  // 收集文件
  const files = await collectFiles(target, recursive)

  if (files.length === 0) {
    console.error(`❌ 没有找到要审查的文件：${target}`)
    process.exit(1)
  }

  console.log(`📋 审查目标：${files.length} 个文件`)
  files.forEach(f => console.log(`   - ${f}`))
  console.log()

  // 创建审查 Agent
  const reviewer = agent({
    role: "资深代码审查员",
    goal: "发现代码中的 bug、安全隐患、性能问题，并提出建设性改进建议",
    background: [
      "你有 15 年编程经验，精通 TypeScript、Node.js 和系统设计",
      "你审查过 1000+ Pull Request，擅长发现边界条件和潜在风险",
      "你熟悉 OWASP Top 10 安全漏洞和常见性能反模式",
      "你的审查风格：直接、具体、有例子，帮助作者而不是挑剔",
    ].join("；"),
    model: "deepseek/deepseek-chat",
    tools: [readFile, listDir],
    rules: {
      focus: [
        "逻辑错误和边界条件",
        "安全漏洞（如注入、XSS、敏感信息泄露）",
        "性能问题（如 N+1 查询、同步阻塞）",
        "可读性和可维护性",
        "类型安全（TypeScript 最佳实践）",
      ],
      reject: [
        "不要修改任何代码",
        "不要批评作者，只指出问题",
        "不要要求作者添加过度工程化的设计",
      ],
    },
    maxTurns: 20,
  })

  // 构建审查任务
  const fileList = files.map(f => `- ${f}`).join("\n")

  const reviewTask = [
    `请审查以下 ${files.length} 个文件：`,
    "",
    fileList,
    "",
    "步骤要求：",
    "1. 依次读取每个文件的内容",
    "2. 逐文件分析代码质量和潜在问题",
    "3. 输出结构化审查报告",
    "",
    "输出格式：",
    `## 总体评价（共 ${files.length} 个文件）`,
    "## 关键问题（按严重程度排列，每个问题说明：位置、问题、建议修复方式）",
    "## 次要建议",
    "## 值得肯定的地方",
  ].join("\n")

  console.log("⏳ 审查中...\n")

  const startTime = Date.now()

  try {
    const result = await reviewer.run(reviewTask)

    console.log("\n📋 审查结果：\n")
    console.log(result.output)
    console.log(`\n⏱️  耗时: ${result.duration}ms | tokens: ${result.usage.totalTokens}`)
    console.log(`📁 审查了 ${files.length} 个文件`)
  } catch (err: any) {
    console.error(`\n❌ 审查失败：${err.message}`)
    process.exit(1)
  }
}

main()
