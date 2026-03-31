/**
 * 道（Dao）— 翻译 Agent 示例
 *
 * 演示：memory 多轮对话 + systemPrompt 自定义
 *
 * 运行：
 *   npx tsx examples/translator.ts                        # 演示默认翻译流程
 *   npx tsx examples/translator.ts "Hello world" zh       # 翻译指定文本为中文
 *   npx tsx examples/translator.ts "你好" en             # 翻译指定文本为英文
 *   npx tsx examples/translator.ts --batch               # 批量翻译模式
 */

import "dotenv/config"
import { agent } from "dao-ai"

// ============================================================
// CLI 参数解析
// ============================================================

interface CliArgs {
  mode: "demo" | "single" | "batch"
  text?: string
  targetLang?: string
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)

  if (args[0] === "--help" || args[0] === "-h") {
    printHelp()
    process.exit(0)
  }

  if (args[0] === "--batch" || args[0] === "-b") {
    return { mode: "batch" }
  }

  // 单次翻译：translator.ts "文本" <目标语言>
  // 目标语言默认为 zh（中文），可指定 en
  if (args.length >= 1 && !args[0].startsWith("-")) {
    return {
      mode: "single",
      text: args[0],
      targetLang: args[1] ?? "zh",
    }
  }

  return { mode: "demo" }
}

function printHelp() {
  console.log(`
翻译 Agent 示例 — 基于 Dao 框架的多语言翻译

用法：
  npx tsx examples/translator.ts [文本] [目标语言] [选项]
  npx tsx examples/translator.ts --batch

参数：
  文本          要翻译的文本（可选，不填则运行演示模式）
  目标语言      目标语言代码（zh/en/ja/ko/fr/de，默认：zh）

选项：
  --batch, -b   批量翻译模式（演示文件列表翻译）
  --help, -h    显示此帮助信息

示例：
  npx tsx examples/translator.ts "Hello, world!" zh
  npx tsx examples/translator.ts "你好" en
  npx tsx examples/translator.ts "Good morning" ja
  npx tsx examples/translator.ts --batch
`)
}

// ============================================================
// 创建翻译 Agent
// ============================================================

function createTranslator(targetLang: string): ReturnType<typeof agent> {
  const langNames: Record<string, string> = {
    zh: "中文",
    en: "英文",
    ja: "日文",
    ko: "韩文",
    fr: "法文",
    de: "德文",
    es: "西班牙文",
    pt: "葡萄牙文",
    ru: "俄文",
    ar: "阿拉伯文",
  }
  const langName = langNames[targetLang] ?? targetLang

  return agent({
    role: `专业${langName}翻译`,
    goal: "准确翻译文本，保持原文风格和语气",
    background: [
      "你是一个专业翻译，精通中英互译以及其他多语言翻译",
      "你翻译时保持原文风格：正式文本用正式语气，口语用口语",
      "你只输出翻译结果，不添加任何解释或备注",
      "遇到专有名词保留原文或使用通用译法",
    ].join("。"),
    model: "deepseek/deepseek-chat",
    memory: true,
    systemPrompt: `你是一个专业翻译，擅长多语言互译。翻译时保持原文风格，不添加解释。`,
  })
}

// ============================================================
// 单次翻译
// ============================================================

async function translateSingle(text: string, targetLang: string) {
  const langNames: Record<string, string> = {
    zh: "中文", en: "英文", ja: "日文", ko: "韩文",
    fr: "法文", de: "德文", es: "西班牙文",
  }
  const langName = langNames[targetLang] ?? targetLang

  console.log(`📋 翻译：${text}`)
  console.log(`🎯 目标语言：${langName}\n`)

  const bot = createTranslator(targetLang)
  const result = await bot.chat(
    `翻译成${langName}，只输出译文：${text}`
  )

  console.log(`✅ 译文：${result}`)
}

// ============================================================
// 演示：多轮翻译（记忆保持）
// ============================================================

async function demoMultiturn() {
  console.log("=== 演示：多轮翻译（记忆保持上下文风格）===\n")

  const translator = createTranslator("en")

  // 第 1 轮：翻译
  console.log("【第 1 轮】翻译中文为英文")
  const r1 = await translator.chat("翻译成英文：大道至简，渐进复杂")
  console.log("  译文:", r1)

  // 第 2 轮：风格调整
  console.log("\n【第 2 轮】调整风格为更文学的表达")
  const r2 = await translator.chat("把刚才的翻译改成更文学、更有韵律感的表达")
  console.log("  文学版:", r2)

  // 第 3 轮：回译验证
  console.log("\n【第 3 轮】回译到中文验证准确性")
  const r3 = await translator.chat("再把它翻译回中文")
  console.log("  回译:", r3)

  console.log("\n--- 批量翻译演示 ---\n")

  // 批量翻译不同风格的文本
  const batchTexts = [
    { text: "你好，世界！", note: "日常问候" },
    { text: "本公司成立于 2024 年，主要从事人工智能技术研发", note: "商务文本" },
    { text: "TypeScript 是 JavaScript 的超集，添加了类型系统", note: "技术文档" },
  ]

  const batchBot = createTranslator("en")

  for (const item of batchTexts) {
    const result = await batchBot.chat(`翻译成英文，只输出译文：${item.text}`)
    console.log(`[${item.note}] "${item.text}" → "${result}"`)
  }
}

// ============================================================
// 批量翻译模式
// ============================================================

async function demoBatch() {
  console.log("=== 批量翻译模式 ===\n")

  const batchItems = [
    { text: "你好，世界！", lang: "en" },
    { text: "人工智能正在改变世界", lang: "en" },
    { text: "TypeScript 让代码更健壮", lang: "ja" },
    { text: "开源社区推动技术进步", lang: "ko" },
    { text: "大道至简，渐进复杂", lang: "en" },
  ]

  console.log(`📋 待翻译：${batchItems.length} 个文本\n`)

  for (let i = 0; i < batchItems.length; i++) {
    const item = batchItems[i]
    const bot = createTranslator(item.lang)
    process.stdout.write(`[${i + 1}/${batchItems.length}] `)

    const result = await bot.chat(`翻译成目标语言，只输出译文：${item.text}`)
    console.log(`"${item.text}" → "${result}"`)
  }

  console.log("\n✅ 批量翻译完成")
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  console.log("========================================")
  console.log("  Dao — 翻译 Agent 示例")
  console.log("========================================\n")

  const args = parseArgs()

  switch (args.mode) {
    case "single":
      await translateSingle(args.text!, args.targetLang!)
      break
    case "batch":
      await demoBatch()
      break
    case "demo":
    default:
      await demoMultiturn()
      console.log("\n✅ 演示完成！")
      console.log("\n其他用法：")
      console.log("  npx tsx examples/translator.ts \"Hello world\" zh    # 翻译为中文")
      console.log("  npx tsx examples/translator.ts \"你好\" en           # 翻译为英文")
      console.log("  npx tsx examples/translator.ts --batch              # 批量翻译")
      break
  }
}

main().catch(err => {
  console.error(`\n❌ 翻译示例失败：${err.message}`)
  process.exit(1)
})
