/**
 * 道（Dao）— 多 Agent 协作团队示例
 *
 * team() 将多个专业化 Agent 组成团队，lead Agent 负责分解任务并通过
 * delegate 工具调度成员执行。成员执行结果自动汇总。
 *
 * 演示场景：为一个新功能需求生成完整代码
 *   lead（产品经理）→ 规划
 *   coder（开发者）  → 写代码
 *   reviewer（测试）  → 审查代码
 *
 * 运行：
 *   npx tsx examples/team.ts                              # 完整演示（规划 + 开发 + 审查）
 *   npx tsx examples/team.ts "写一个待办事项 CLI 工具"    # 指定任务
 *   npx tsx examples/team.ts --members                    # 仅列出团队成员
 *   npx tsx examples/team.ts --help                      # 查看帮助
 */

import "dotenv/config"
import { agent, team, tool } from "dao-ai"
import { readFile, writeFile, runCommand } from "dao-ai/tools"

// ============================================================
// CLI 参数解析
// ============================================================

function parseArgs(): { task: string; listMembers: boolean } {
  const args = process.argv.slice(2)

  if (args[0] === "--help" || args[0] === "-h") {
    printHelp()
    process.exit(0)
  }

  if (args[0] === "--members" || args[0] === "-m") {
    return { task: "", listMembers: true }
  }

  const rest = args.filter(a => !a.startsWith("-"))
  const task = rest.join(" ") || ""

  return { task, listMembers: false }
}

function printHelp() {
  console.log(`
多 Agent 协作团队示例 — team() 演示

用法：
  npx tsx examples/team.ts [任务描述] [选项]
  npx tsx examples/team.ts --members

参数：
  任务描述     要执行的任务（可选，不填使用默认演示任务）

选项：
  --members, -m   仅列出团队成员，不执行任务
  --help, -h      显示此帮助信息

团队成员：
  - planner  产品经理：分解需求，输出技术方案
  - coder   开发者：基于方案生成代码
  - reviewer 测试工程师：审查代码质量，输出改进建议

团队策略：
  - lead Agent 自动判断使用顺序委派（sequential）或并行委派（parallel）
  - 支持自动重试失败的成员调用
`)
}

// ============================================================
// 定义团队成员
// ============================================================

// 产品经理：分析需求，输出实现方案
const planner = agent({
  role: "资深产品经理",
  goal: "分析需求，输出清晰可执行的技术方案",
  background: [
    "你擅长将模糊的产品需求转化为具体的技术实现步骤",
    "你会输出结构化的方案：功能拆解、技术选型、接口设计、数据模型",
    "方案要简洁实用，适合快速迭代",
  ].join("。"),
  model: "deepseek/deepseek-chat",
  maxTurns: 10,
})

// 开发者：基于方案写代码
const coder = agent({
  role: "全栈工程师",
  goal: "根据技术方案生成高质量、可直接运行的代码",
  background: [
    "你精通 TypeScript / Node.js，代码风格遵循最佳实践",
    "你会生成完整的代码文件，包括类型定义、错误处理、单元测试",
    "你写代码时自动考虑边界条件和异常情况",
  ].join("。"),
  model: "deepseek/deepseek-chat",
  tools: [writeFile],
  maxTurns: 15,
})

// 测试工程师：审查代码质量
const reviewer = agent({
  role: "资深测试工程师",
  goal: "审查代码质量，发现 bug 并提出改进建议",
  background: [
    "你有 10 年测试经验，精通各类测试策略",
    "你会覆盖：正常路径、边界值、空输入、异常输入",
    "你审查风格：直接、具体、有代码示例",
  ].join("。"),
  model: "deepseek/deepseek-chat",
  tools: [readFile, runCommand],
  rules: {
    focus: ["bug", "边界条件", "性能隐患", "安全问题"],
    reject: ["不要修改代码", "不要执行破坏性操作"],
  },
  maxTurns: 10,
})

// ============================================================
// 创建团队
// ============================================================

const squad = team({
  members: { planner, coder, reviewer },
  // 可选：自定义 lead，不指定则自动创建默认 lead
  // lead: agent({ role: "技术总监", model: "deepseek/deepseek-chat" }),
  strategy: "auto",  // auto / sequential / parallel
  maxRounds: 30,
})

// ============================================================
// 列出团队成员
// ============================================================

function listMembers() {
  const members = squad.getMembers()
  console.log("团队成员：")
  for (const [name, member] of Object.entries(members)) {
    const cfg = member.getConfig()
    console.log(`  👤 ${name}`)
    console.log(`     角色: ${cfg.role ?? "通用 Agent"}`)
    console.log(`     模型: ${cfg.model}`)
    console.log(`     工具: ${cfg.tools?.length ?? 0} 个`)
    console.log(`     maxTurns: ${cfg.maxTurns ?? "默认"}`)
    console.log()
  }
}

// ============================================================
// 主流程：规划 → 开发 → 审查
// ============================================================

async function main() {
  console.log("========================================")
  console.log("  Dao — 多 Agent 协作团队示例")
  console.log("========================================\n")

  const { task: cliTask, listMembers: showMembers } = parseArgs()

  if (showMembers) {
    listMembers()
    return
  }

  const defaultTask = "用 TypeScript 实现一个命令行待办事项管理工具（支持增删改查、优先级、数据持久化）"
  const task = cliTask || defaultTask

  console.log(`📋 任务：${task}\n`)

  const startTime = Date.now()

  // run() 返回 TeamRunResult，包含 lead 输出 + 所有成员结果
  const result = await squad.run(
    [
      `请完成以下任务，通过 delegate 工具协调团队成员执行：\n\n${task}`,
      "",
      "团队分工建议：",
      "1. 先让 planner 分析需求，输出技术方案",
      "2. 再让 coder 根据方案生成代码",
      "3. 最后让 reviewer 审查代码质量",
      "",
      "最终输出一个完整可用的代码文件（写入 src/todo.ts），",
      "并给出审查意见和改进建议。",
    ].join("\n")
  )

  // ============================================================
  // 汇总结果
  // ============================================================

  console.log("\n========================================")
  console.log("  执行结果汇总")
  console.log("========================================\n")

  // lead 的最终输出
  console.log("📤 Lead 最终输出：\n")
  console.log(result.output)

  // 各成员的执行结果
  console.log("\n========================================")
  console.log("  各成员执行记录")
  console.log("========================================\n")

  for (const [memberName, results] of Object.entries(result.memberResults)) {
    if (results.length === 0) continue
    console.log(`👤 成员：${memberName}（执行了 ${results.length} 次）`)
    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      const preview = r.output.length > 200
        ? r.output.slice(0, 200) + "..."
        : r.output
      console.log(`  【第 ${i + 1} 次调用】`)
      console.log(`  ${preview}\n`)
    }
  }

  // 统计
  const memberCallCount = Object.values(result.memberResults)
    .reduce((sum, arr) => sum + arr.length, 0)

  console.log("========================================")
  console.log("  执行统计")
  console.log("========================================")
  console.log(`⏱️  总耗时：${result.duration}ms`)
  console.log(`💰 Token 用量：`)
  console.log(`   promptTokens: ${result.usage.promptTokens}`)
  console.log(`   completionTokens: ${result.usage.completionTokens}`)
  console.log(`   totalTokens: ${result.usage.totalTokens}`)
  console.log(`👥 成员调用次数：${memberCallCount}`)
  console.log(`📁 成员结果数量：${Object.keys(result.memberResults).length} 个成员`)
}

// ============================================================
// 流式演示（展示团队协作过程）
// ============================================================

async function demoStream() {
  console.log("\n========================================")
  console.log("  流式演示（展示 delegate 过程）")
  console.log("========================================\n")

  const task = "写一个函数计算数组中所有素数的和"

  process.stdout.write("团队协作中")
  const dots = [".", "..", "..."]

  let eventCount = 0
  for await (const event of squad.runStream(task)) {
    eventCount++

    if (event.type === "step_start") {
      process.stdout.write(`\n▶ ${event.member ?? "lead"} 开始执行步骤...\n`)
    } else if (event.type === "step_end") {
      process.stdout.write(`\n✓ ${event.member ?? "lead"} 步骤完成\n`)
    } else if (event.type === "text") {
      // 实时显示文字输出
      if (eventCount < 10) {
        process.stdout.write(event.data)
      }
    } else if (event.type === "done") {
      console.log(`\n✅ 团队协作完成！`)
      console.log(`💰 Token: ${event.data?.usage?.totalTokens ?? 0}`)
    }
  }
}

// ============================================================
// 入口
// ============================================================

async function run() {
  const { task } = parseArgs()

  if (process.argv.includes("--stream")) {
    await demoStream()
    return
  }

  await main()
}

run().catch(err => {
  console.error(`\n❌ 团队执行失败：${err.message}`)
  process.exit(1)
})
