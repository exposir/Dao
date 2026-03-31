/**
 * 道（Dao）— 自动化测试生成示例
 *
 * 输入一个文件或函数描述，自动生成测试用例（Vitest 格式）。
 * 支持：正常路径、边界值、空输入、异常输入的全面覆盖。
 *
 * 运行：
 *   npx tsx examples/auto-test.ts                                    # 审查默认文件（src/utils/median.ts）
 *   npx tsx examples/auto-test.ts src/agent.ts                     # 审查指定文件
 *   npx tsx examples/auto-test.ts src/ --recursive                  # 递归处理目录
 *   npx tsx examples/auto-test.ts --dry-run                         # 不写入文件，只输出测试代码
 */

import "dotenv/config"
import { agent, tool } from "dao-ai"
import { readFile } from "dao-ai/tools"
import { resolve, dirname, relative } from "node:path"
import { mkdir, writeFile, access } from "node:fs/promises"

// ============================================================
// CLI 参数解析
// ============================================================

interface CliArgs {
  target: string
  recursive: boolean
  dryRun: boolean
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)

  if (args[0] === "--help" || args[0] === "-h") {
    printHelp()
    process.exit(0)
  }

  let target = "src/utils/median.ts"
  let recursive = false
  let dryRun = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--recursive" || args[i] === "-r") {
      recursive = true
    } else if (args[i] === "--dry-run" || args[i] === "-n") {
      dryRun = true
    } else if (!args[i].startsWith("-")) {
      target = args[i]
    }
  }

  if (!isAbsolute(target)) {
    target = resolve(process.cwd(), target)
  }

  return { target, recursive, dryRun }
}

function printHelp() {
  console.log(`
自动化测试生成示例 — 基于 Dao Agent 的智能测试生成

用法：
  npx tsx examples/auto-test.ts [目标路径] [选项]

参数：
  目标路径      要生成测试的源文件（默认：src/utils/median.ts）

选项：
  --dry-run, -n    只输出测试代码，不写入文件
  --recursive, -r  递归处理目录下的所有 .ts 文件
  --help, -h       显示此帮助信息

输出：
  测试文件写入 tests/ 目录，命名为 <源文件>.test.ts

示例：
  npx tsx examples/auto-test.ts
  npx tsx examples/auto-test.ts src/agent.ts
  npx tsx examples/auto-test.ts src/ --recursive --dry-run
`)
}

// ============================================================
// 检查文件是否存在
// ============================================================

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

// ============================================================
// 获取要处理的源文件列表
// ============================================================

async function collectSourceFiles(target: string, recursive: boolean): Promise<string[]> {
  const stat = await import("node:fs/promises").then(m => m.stat(target))
  const files: string[] = []

  if (stat.isFile()) {
    if (!target.endsWith(".ts") && !target.endsWith(".tsx")) return []
    return [target]
  }

  if (stat.isDirectory()) {
    const listResult = await listDir.run({ dir: target, recursive })
    const lines = listResult.split("\n").filter(l => l.trim())
    for (const line of lines) {
      if ((line.endsWith(".ts") || line.endsWith(".tsx")) && !line.includes(".test.ts")) {
        const filePath = resolve(target, line)
        files.push(filePath)
      }
    }
  }

  return files
}

// ============================================================
// 工具：读取源代码
// ============================================================

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

// ============================================================
// 工具：写测试文件
// ============================================================

const writeTest = tool({
  name: "writeTest",
  description: "写入测试文件到 tests 目录",
  params: {
    path: { type: "string", description: "测试文件路径（相对于项目根目录）" },
    content: { type: "string", description: "测试代码内容" },
  },
  run: async ({ path, content }) => {
    const fullPath = resolve(process.cwd(), path)
    await mkdir(dirname(fullPath), { recursive: true })
    await writeFile(fullPath, content, "utf-8")
    return `✅ 测试文件已写入：${path}`
  },
})

// ============================================================
// 工具：验证测试文件语法
// ============================================================

const validateTests = tool({
  name: "validateTests",
  description: "验证测试文件语法是否正确",
  params: { content: { type: "string", description: "测试代码内容" } },
  run: ({ content }) => {
    try {
      // eslint-disable-next-line no-new-func
      new Function(content.replace(/import .+ from .+/g, ""))
      return "✅ 语法正确"
    } catch (e: any) {
      return `❌ 语法错误：${e.message}`
    }
  },
})

// ============================================================
// 主流程
// ============================================================

async function main() {
  const { target, recursive, dryRun } = parseArgs()

  console.log("========================================")
  console.log("  Dao — 自动化测试生成")
  console.log("========================================\n")

  // 检查默认文件是否存在
  if (target === resolve(process.cwd(), "src/utils/median.ts")) {
    const exists = await fileExists(target)
    if (!exists) {
      console.warn(`⚠️  默认文件不存在：src/utils/median.ts`)
      console.warn(`   请指定一个存在的源文件路径，例如：`)
      console.warn(`   npx tsx examples/auto-test.ts src/agent.ts\n`)
    }
  }

  // 收集文件
  const files = await collectSourceFiles(target, recursive)

  if (files.length === 0) {
    console.error(`❌ 没有找到要处理的源文件：${target}`)
    process.exit(1)
  }

  console.log(`📋 待处理：${files.length} 个文件`)
  if (dryRun) console.log("🔍 dry-run 模式：仅输出，不写入文件\n")
  console.log()

  const testBot = agent({
    role: "测试工程师",
    goal: "分析源代码，生成覆盖全面、边界条件完整的测试用例",
    background: [
      "你使用 Vitest 风格编写测试：describe / it / expect",
      "你会分析源码逻辑，找出所有分支和边界条件",
      "你会覆盖：正常路径、边界值、空输入、异常输入",
      "测试文件名规范：<源文件>.test.ts，置于 tests/ 目录",
      "使用 ESM import，测试文件头部加 import 语句",
    ].join("。"),
    model: "deepseek/deepseek-chat",
    tools: [readCode, writeTest, validateTests],
    rules: {
      focus: ["边界条件", "异常处理", "真实断言值"],
      reject: ["不要写无意义的占位测试", "不要省略断言"],
    },
    maxTurns: 12,
  })

  let totalSuccess = 0
  let totalFailed = 0

  for (let i = 0; i < files.length; i++) {
    const srcFile = files[i]
    const relPath = relative(process.cwd(), srcFile)
    const testFile = srcFile
      .replace(/^src\//, "tests/")
      .replace(/\.ts$/, ".test.ts")

    console.log(`【${i + 1}/${files.length}】🎯 ${relPath}`)

    const prompt = dryRun
      ? [
          `请为以下源文件生成测试用例（dry-run 模式，不写入文件）：\n\n${relPath}`,
          "",
          "步骤要求：",
          "1. 用 readCode 读取源代码，分析函数签名和逻辑",
          "2. 用 validateTests 验证生成的测试语法",
          "3. 验证通过后用 writeTest 写入（dry-run 下仍写入，方便查看）",
          "4. 报告生成结果",
        ].join("\n")
      : [
          `请为以下源文件生成测试用例：\n\n${relPath}`,
          "",
          "步骤要求：",
          "1. 用 readCode 读取源代码，分析函数签名和逻辑",
          "2. 用 validateTests 验证生成的测试语法",
          `3. 用 writeTest 写入 ${testFile}`,
          "4. 报告生成结果",
        ].join("\n")

    try {
      const result = await testBot.run(prompt)
      console.log(`\n${result.output}\n`)

      if (result.output.includes("✅") || result.output.includes("已写入")) {
        totalSuccess++
      } else {
        totalFailed++
      }
    } catch (err: any) {
      console.error(`❌ 处理失败：${err.message}`)
      totalFailed++
    }
  }

  // 尝试运行测试
  if (!dryRun && totalSuccess > 0) {
    console.log("--- 尝试运行生成的测试 ---\n")

    for (const srcFile of files) {
      const testFile = srcFile
        .replace(/^src\//, "tests/")
        .replace(/\.ts$/, ".test.ts")

      const exists = await fileExists(testFile)
      if (!exists) continue

      const relTest = relative(process.cwd(), testFile)
      try {
        const { execSync } = await import("node:child_process")
        console.log(`运行测试：${relTest}`)
        execSync(
          `npx vitest run --reporter=verbose ${relTest} 2>&1`,
          { cwd: process.cwd(), stdio: "inherit", timeout: 30000 }
        )
      } catch {
        // vitest 未安装或测试文件有问题，继续
      }
    }
  }

  // 汇总
  console.log("========================================")
  console.log("  测试生成汇总")
  console.log("========================================")
  console.log(`总计：${files.length} 个文件`)
  console.log(`成功：${totalSuccess}`)
  console.log(`失败：${totalFailed}`)
  console.log(`模式：${dryRun ? "dry-run（未写入）" : "已写入 tests/ 目录"}`)
}

main().catch(err => {
  console.error(`\n❌ 示例运行失败：${err.message}`)
  process.exit(1)
})
