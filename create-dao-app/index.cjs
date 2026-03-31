#!/usr/bin/env node
/**
 * create-dao-app — Dao 项目脚手架
 *
 * 交互式创建基于 Dao 框架的新项目。
 * 纯 Node.js 实现，无外部依赖。
 *
 * 用法：
 *   node create-dao-app/index.js
 *   node create-dao-app/index.js --name my-app
 */

"use strict"

const { copyFileSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } = require("node:fs")
const { join, dirname, relative } = require("node:path")
const readline = require("readline/promises")

const TEMPLATE_DIR = join(__dirname, "template")
const ROOT_DIR = join(__dirname, "..", "..")

// ============================================================
// 终端样式（纯 ANSI，无外部依赖）
// ============================================================

const R = "\x1b[0m"
const B = "\x1b[1m"
const DIM = "\x1b[2m"
const C = "\x1b[36m"
const G = "\x1b[32m"
const Y = "\x1b[33m"
const GR = "\x1b[90m"
const R_ = "\x1b[31m"

const CHECK = `${G}✓${R}`
const CROSS = `${R_}✗${R}`
const ARROW = `${C}›${R}`

function logo() {
  console.log(`${C}
   ██████╗ ██████╗ ███████╗██╗███████╗██╗  ██╗██╗   ██╗
  ██╔══██╗██╔══██╗██╔════╝██║██╔════╝██║  ██║██║   ██║
  ██║  ██║██████╔╝███████╗██║███████╗███████║██║   ██║
  ██║  ██║██╔══██╗╚════██║██║╚════██║██╔══██║██║   ██║
  ██████╔╝██║  ██║███████║██║███████║██║  ██║╚██████╔╝
  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝
${R}  ${DIM}create-dao-app — 一键创建 Dao 项目${R}
`)
}

async function ask(question, options, defaultVal) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const prompt = options
    ? `${Y}?${R} ${question} ${GR}(${options.join(" / ")})${R} ${GR}[${defaultVal}]${R}: `
    : `${Y}?${R} ${question}: `
  const answer = await rl.question(prompt).catch(() => defaultVal ?? "")
  rl.close()
  return answer.trim() || defaultVal
}

async function confirm(question, defaultVal = true) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const defaultStr = defaultVal ? `${GR}[Y/n]` : `${GR}[y/N]`
  const answer = await rl.question(`${Y}?${R} ${question} ${defaultStr}: `).catch(() => "")
  rl.close()
  if (!answer.trim()) return defaultVal
  return answer.trim().toLowerCase().startsWith("y")
}

// ============================================================
// 文件操作
// ============================================================

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true })
  const entries = readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === "node_modules") continue
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      copyFileSync(srcPath, destPath)
    }
  }
}

function replaceInFile(filePath, vars) {
  let content = readFileSync(filePath, "utf-8")
  for (const [key, val] of Object.entries(vars)) {
    content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val)
  }
  writeFileSync(filePath, content, "utf-8")
}

function getTemplateSize(dir) {
  let size = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) size += getTemplateSize(full)
    else size += statSync(full).size
  }
  return size
}

// ============================================================
// 颜色化输出
// ============================================================

function log(action, message) {
  const icons = {
    create: `${C}创建${R}`,
    copy: `${C}复制${R}`,
    skip: `${GR}跳过${R}`,
    done: `${G}完成${R}`,
    info: `${GR}信息${R}`,
    warn: `${Y}警告${R}`,
  }
  console.log(`  ${icons[action] ?? action}  ${message}`)
}

// ============================================================
// 交互式创建
// ============================================================

// ============================================================
// 非交互式创建（命令行参数模式）
// ============================================================

async function createFromArgs(args) {
  const modelMap = {
    deepseek: "deepseek/deepseek-chat",
    openai: "openai/gpt-4o",
    google: "google/gemini-2.0-flash",
  }

  const cleanName = (args.name || "my-dao-app").replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase()
  const assistantRole = args.role || "智能助手"
  const assistantGoal = args.goal || "尽我所能帮助用户完成各种任务"

  let modelString
  if (args.model && args.model.includes("/")) {
    modelString = args.model
  } else {
    modelString = modelMap[args.model] || modelMap.deepseek
  }

  const toolsDefault = ["readFile", "listDir", "runCommand", "webSearch", "calculator"]
  const selectedTools = (args.tools && args.tools.length > 0)
    ? args.tools.filter(t => toolsDefault.includes(t))
    : toolsDefault

  return await createApp({ cleanName, assistantRole, assistantGoal, modelString, selectedTools, noInstall: args.noInstall, fromArgs: true })
}

// ============================================================
// 交互式创建
// ============================================================

async function createApp(opts) {
  // opts 存在时为非交互模式（fromArgs=true），直接使用预设值

  let cleanName, assistantRole, assistantGoal, modelString, selectedTools, noInstall

  if (opts && opts.fromArgs) {
    // 非交互模式
    cleanName = opts.cleanName
    assistantRole = opts.assistantRole
    assistantGoal = opts.assistantGoal
    modelString = opts.modelString
    selectedTools = opts.selectedTools
    noInstall = opts.noInstall

    console.clear()
    logo()
    console.log(`  ${G}使用命令行参数（非交互模式）${R}\n`)
  } else {
    // 交互模式
    console.clear()
    logo()

    const projectName = await ask("项目名称", null, "my-dao-app")
    cleanName = projectName.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase()
    if (cleanName !== projectName) log("warn", `项目名称已规范化为：${cleanName}`)

    assistantRole = await ask("助手身份（role）", null, "智能助手")
    assistantGoal = await ask("助手目标（goal）", null, "尽我所能帮助用户完成各种任务")

    const model = await ask("模型", ["deepseek", "openai", "google", "custom"], "deepseek")

    if (model === "custom") {
      modelString = await ask("输入模型（格式：provider/model）", null, "deepseek/deepseek-chat")
    } else {
      const modelMap = { deepseek: "deepseek/deepseek-chat", openai: "openai/gpt-4o", google: "google/gemini-2.0-flash" }
      modelString = modelMap[model]
    }

    const toolsDefault = "readFile,listDir,runCommand,webSearch,calculator"
    const toolsAnswer = await ask("内置工具", null, toolsDefault)
    selectedTools = (toolsAnswer || toolsDefault).split(",").map(t => t.trim()).filter(Boolean)
    selectedTools = selectedTools.filter(t => ["readFile", "listDir", "runCommand", "webSearch", "calculator"].includes(t))

    noInstall = false

    console.log(`\n  ${C}›${R} 已选择工具：`)
    const toolChoices = { readFile: "readFile（读取文件）", listDir: "listDir（浏览目录）", runCommand: "runCommand（执行命令）", webSearch: "webSearch（网络搜索）", calculator: "calculator（计算器）" }
    for (const t of selectedTools) console.log(`    ${CHECK} ${toolChoices[t] ?? t}`)

    const ok = await confirm("以上配置确认无误，开始创建项目？", true)
    if (!ok) { console.log(`\n${CROSS} 已取消。\n`); return }
  }

  const destDir = join(process.cwd(), cleanName)

  try {
    statSync(destDir)
    console.log(`  ${CROSS} 目录 ${destDir} 已存在，请先删除或使用其他名称。\n`)
    return
  } catch { /* 继续 */ }

  process.stdout.write(`  ${C}◐${R} 复制模板文件...\n`)
  try {
    copyDir(TEMPLATE_DIR, destDir)
    log("done", `复制到 ${cleanName}/`)
  } catch (err) {
    log("warn", `复制失败：${err.message}\n`)
    return
  }

  const vars = { name: cleanName, assistantRole, assistantGoal, modelString }
  const agentPath = join(destDir, "src", "agent.ts")
  replaceInFile(agentPath, vars)

  // 动态替换工具数组和 import 语句
  const toolComments = { readFile: "读取文件", listDir: "浏览目录", runCommand: "执行命令（慎用）", webSearch: "网络搜索（见 tools.ts）", calculator: "计算器（见 tools.ts）" }
  const builtinTools = ["readFile", "listDir", "runCommand"]
  const customTools = ["webSearch", "calculator"]
  const selectedBuiltin = selectedTools.filter(t => builtinTools.includes(t))
  const selectedCustom = selectedTools.filter(t => customTools.includes(t))
  const toolLines = selectedTools.map(t => `    ${t},        // ${toolComments[t]}`).join("\n")
  const importParts = []
  if (selectedBuiltin.length > 0) importParts.push(`import { ${selectedBuiltin.join(", ")} } from "dao-ai/tools"`)
  if (selectedCustom.length > 0) importParts.push(`import { ${selectedCustom.join(", ")} } from "./tools.js"`)
  const newImports = importParts.join("\n")

  // 1. 替换工具导入
  let agentContent = readFileSync(agentPath, "utf-8")
  agentContent = agentContent.replace(
    /\/\/ === TOOL_IMPORTS ===[\s\S]*?\/\/ === END TOOL_IMPORTS ===/,
    `// === TOOL_IMPORTS ===\n${newImports}\n// === END TOOL_IMPORTS ===`
  )

  // 2. 替换工具数组
  agentContent = agentContent.replace(
    /tools: \[[\s\S]*?\],/,
    `tools: [\n${toolLines}\n  ],`
  )

  writeFileSync(agentPath, agentContent, "utf-8")

  replaceInFile(join(destDir, "package.json"), { name: cleanName })
  replaceInFile(join(destDir, "README.md"), { name: cleanName })

  if (!noInstall) {
    process.stdout.write(`\n  ${C}◐${R} 安装依赖...\n`)
    const { execSync } = require("node:child_process")
    try {
      execSync("npm install --prefer-offline", { cwd: destDir, stdio: "inherit", env: { ...process.env, npm_config_yes: "true" } })
      log("done", "依赖安装完成")
    } catch {
      log("warn", "依赖安装失败，请稍后手动运行 npm install\n")
    }
  } else {
    log("info", "已跳过依赖安装（--no-install）\n")
  }

  // dao-ai 指向本地源码（如在 Dao 仓库内运行）
  try {
    const daoPkg = JSON.parse(readFileSync(join(ROOT_DIR, "package.json"), "utf-8"))
    if (daoPkg.name === "dao-ai") {
      const localPath = relative(destDir, ROOT_DIR)
      const pkg = JSON.parse(readFileSync(join(destDir, "package.json"), "utf-8"))
      pkg.dependencies["dao-ai"] = `file:${localPath}`
      writeFileSync(join(destDir, "package.json"), JSON.stringify(pkg, null, 2) + "\n", "utf-8")
      log("info", `dao-ai 已指向本地源码（${localPath}）`)
    }
  } catch { /* 使用 npm 版本 */ }

  console.log(`\n${G}
   ╔═══════════════════════════════════════════════╗
   ║                                               ║
   ║   ✓ 项目创建成功！                            ║
   ║                                               ║
   ╚═══════════════════════════════════════════════╝
${R}
  ${GR}项目：${cleanName}/${R}
  ${GR}模型：${modelString}${R}
  ${GR}工具：${selectedTools.join(", ")}${R}
`)

  console.log(`  ${ARROW} 进入项目：${G}cd ${cleanName}${R}`)
  console.log(`  ${ARROW} 启动助手：${G}npm run dev${R}`)
  console.log(`  ${ARROW} 配置 API Key：${G}cp .env.example .env${R}，填入 DEEPSEEK_API_KEY\n`)

  const templateSize = getTemplateSize(TEMPLATE_DIR)
  console.log(`  ${DIM}模板大小：${(templateSize / 1024).toFixed(1)} KB${R}\n`)
}

// ============================================================
// 命令行参数（无交互模式）
// ============================================================

function parseArgs() {
  const args = process.argv.slice(2)
  const result = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--name" && args[i + 1]) {
      result.name = args[++i]
    } else if (arg === "--role" && args[i + 1]) {
      result.role = args[++i]
    } else if (arg === "--goal" && args[i + 1]) {
      result.goal = args[++i]
    } else if (arg === "--model" && args[i + 1]) {
      result.model = args[++i]
    } else if (arg === "--tools" && args[i + 1]) {
      result.tools = args[++i].split(",")
    } else if (arg === "--no-install") {
      result.noInstall = true
    } else if (arg === "--help" || arg === "-h") {
      result.help = true
    }
  }

  return result
}

function printHelp() {
  console.log(`
${B}create-dao-app — Dao 项目脚手架${R}

${B}用法：${R}
  create-dao-app                       # 交互式创建（推荐）
  create-dao-app --name my-app         # 非交互，指定项目名
  create-dao-app --help                # 显示帮助

${B}选项：${R}
  --name <name>     项目名称
  --role <role>      助手身份
  --goal <goal>      助手目标
  --model <model>    模型（格式：provider/model）
  --tools <list>     工具列表（逗号分隔）
  --no-install       跳过 npm install
  --help, -h         显示此帮助

${B}示例：${R}
  create-dao-app --name my-bot --model deepseek/deepseek-chat
  create-dao-app --name data-agent --tools readFile,webSearch,calculator
`)
}

// ============================================================
// 入口
// ============================================================

const args = parseArgs()

if (args.help) {
  printHelp()
  process.exit(0)
}

const hasCliArgs = args.name || args.role || args.goal || args.model || args.tools

if (hasCliArgs) {
  createFromArgs(args).catch(err => {
    console.error(`\n${R_}错误：${err.message}${R}\n`)
    process.exit(1)
  })
} else {
  createApp().catch(err => {
    console.error(`\n${R_}错误：${err.message}${R}\n`)
    process.exit(1)
  })
}
