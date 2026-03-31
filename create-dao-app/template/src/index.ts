/**
 * Dao 助手 — 入口
 *
 * 运行方式：
 *   npx tsx src/index.ts                       # 交互式对话（REPL）
 *   npx tsx src/index.ts "问题"                # 单次问答
 *   npx tsx src/index.ts --stream "问题"       # 流式输出
 *   npx tsx src/index.ts --help                # 帮助信息
 */

import "dotenv/config"
import readline from "readline/promises"
import { MY_ASSISTANT } from "./agent.js"

// ============================================================
// 终端样式（无外部依赖，纯 ANSI 转义码）
// ============================================================

const RESET = "\x1b[0m"
const BOLD = "\x1b[1m"
const DIM = "\x1b[2m"
const CYAN = "\x1b[36m"
const GREEN = "\x1b[32m"
const YELLOW = "\x1b[33m"
const MAGENTA = "\x1b[35m"
const RED = "\x1b[31m"
const GRAY = "\x1b[90m"

const SEP = `${GRAY}${"─".repeat(50)}${RESET}`

function logo() {
  console.log(`${CYAN}
   ██████╗ ██████╗ ███████╗██╗███████╗██╗  ██╗██╗   ██╗
  ██╔══██╗██╔══██╗██╔════╝██║██╔════╝██║  ██║██║   ██║
  ██║  ██║██████╔╝███████╗██║███████╗███████║██║   ██║
  ██║  ██║██╔══██╗╚════██║██║╚════██║██╔══██║██║   ██║
  ██████╔╝██║  ██║███████║██║███████║██║  ██║╚██████╔╝
  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝
  ${RESET}${DIM}AI Agent 框架 · 渐进式 · 直觉优先${RESET}`)
}

function help() {
  console.log(`
${BOLD}${CYAN}Dao 助手 — 帮助${RESET}

${BOLD}运行方式：${RESET}
  ${GREEN}npx tsx src/index.ts${RESET}                       交互式对话（REPL）
  ${GREEN}npx tsx src/index.ts "问题"${RESET}                单次问答
  ${GREEN}npx tsx src/index.ts --stream "问题"${RESET}        流式输出
  ${GREEN}npx tsx src/index.ts --help${RESET}                 显示此帮助

${BOLD}对话命令：${RESET}
  ${YELLOW}exit${RESET}      退出程序
  ${YELLOW}clear${RESET}     清屏
  ${YELLOW}help${RESET}      显示帮助
  ${YELLOW}token${RESET}     显示累计 token 用量
  ${YELLOW}reset${RESET}     重置对话记忆

${BOLD}流式模式：${RESET}
  使用 ${GREEN}--stream${RESET} 开启流式输出，边生成边显示。

${BOLD}编辑技巧：${RESET}
  ${DIM}在 REPL 中按 Tab 键可补全命令（readline 内置）。${RESET}
  ${DIM}按 Ctrl+C 可取消当前输入，按 Ctrl+D 退出。${RESET}
`)
}

// ============================================================
// 全局统计
// ============================================================

let totalTokens = 0
let turnCount = 0

function printCost() {
  console.log(
    `\n${GRAY}  💰 本次 token: ${totalTokens}  |  对话轮次: ${turnCount}${RESET}`
  )
}

// ============================================================
// 单次问答
// ============================================================

async function singleShot(question: string, stream = false) {
  console.log(`${SEP}`)
  console.log(`${YELLOW}👤 你：${RESET} ${question}`)
  console.log(`${MAGENTA}🤖 Dao：${RESET}`)

  const start = Date.now()

  if (stream) {
    process.stdout.write(`${MAGENTA}   `)
    let fullText = ""
    for await (const chunk of MY_ASSISTANT.chatStream(question)) {
      process.stdout.write(chunk)
      fullText += chunk
    }
    console.log()
    const ms = Date.now() - start
    console.log(`${GRAY}   ✓ ${ms}ms${RESET}`)
  } else {
    const answer = await MY_ASSISTANT.chat(question)
    const ms = Date.now() - start
    console.log(`   ${answer}`)
    console.log(`${GRAY}   ✓ ${ms}ms${RESET}`)
  }

  printCost()
}

// ============================================================
// 交互式 REPL
// ============================================================

async function repl() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer(line: string) {
      const commands = ["exit", "clear", "help", "token", "reset"]
      const matches = commands.filter(c => c.startsWith(line.toLowerCase()))
      return [matches.length > 0 ? matches : [], line]
    },
  })

  logo()
  console.log(`${DIM}输入 help 查看帮助，exit 退出${RESET}`)
  console.log(SEP)

  while (true) {
    const input = await rl.question(`${GREEN}👤 你${RESET} > `).catch(() => "")

    if (!input.trim()) continue

    const [cmd, ...rest] = input.trim().split(/\s+/)
    const question = rest.join(" ")

    // 命令处理
    switch (cmd.toLowerCase()) {
      case "exit":
      case "quit":
      case "q":
        console.log(`${DIM}再见！期待下次相遇。${RESET}`)
        await rl.close()
        return

      case "clear":
      case "cls":
        console.clear()
        logo()
        continue

      case "help":
      case "h":
      case "?":
        help()
        continue

      case "token":
      case "t":
        printCost()
        continue

      case "reset":
      case "r":
        MY_ASSISTANT.clearMemory()
        turnCount = 0
        totalTokens = 0
        console.log(`${DIM}✓ 对话记忆已重置${RESET}`)
        continue
    }

    // 正常对话
    console.log(`${MAGENTA}🤖 Dao：${RESET}`)
    process.stdout.write(`   `)
    const start = Date.now()
    let fullText = ""

    try {
      for await (const chunk of MY_ASSISTANT.chatStream(input)) {
        process.stdout.write(chunk)
        fullText += chunk
      }
    } catch (err: any) {
      console.log(`\n   ${RED}❌ 错误：${err.message}${RESET}`)
      continue
    }

    const ms = Date.now() - start
    turnCount++
    console.log(`\n${GRAY}   ✓ ${ms}ms${RESET}`)
    printCost()
    console.log(SEP)
  }
}

// ============================================================
// 入口
// ============================================================

async function main() {
  const args = process.argv.slice(2)

  if (args.includes("--help") || args.includes("-h")) {
    help()
    return
  }

  logo()
  console.log()

  const streamIdx = args.indexOf("--stream")
  const isStream = streamIdx >= 0

  // 提取问题（去掉 --stream 参数）
  const cleanArgs = isStream ? [...args.slice(0, streamIdx), ...args.slice(streamIdx + 1)] : args
  const question = cleanArgs.join(" ")

  if (question) {
    // 单次模式
    await singleShot(question, isStream)
  } else {
    // 交互模式
    await repl()
  }
}

main().catch(err => {
  console.error(`\n${RED}❌ 运行错误：${err.message}${RESET}`)
  process.exit(1)
})
