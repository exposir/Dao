/**
 * 道（Dao）— 国际化（i18n）示例
 *
 * 演示：
 *   1. 中英文模式切换（setLocale）
 *   2. 框架内置错误信息的本地化
 *   3. 多语言 Agent 对话
 *
 * 运行：
 *   npx tsx examples/i18n.ts              # 默认：中英文双语演示
 *   npx tsx examples/i18n.ts --lang zh     # 仅中文
 *   npx tsx examples/i18n.ts --lang en     # 仅英文
 */

import "dotenv/config"
import { agent, setLocale, getLocale, t } from "dao-ai"

// ============================================================
// CLI 参数解析
// ============================================================

type Locale = "zh" | "en"

function parseArgs(): { locale: Locale; single: boolean } {
  const args = process.argv.slice(2)

  if (args[0] === "--help" || args[0] === "-h") {
    printHelp()
    process.exit(0)
  }

  const langIdx = args.indexOf("--lang")
  if (langIdx >= 0 && args[langIdx + 1]) {
    const lang = args[langIdx + 1].toLowerCase()
    if (lang === "zh" || lang === "en") {
      return { locale: lang, single: true }
    }
  }

  return { locale: "zh", single: false }
}

function printHelp() {
  console.log(`
国际化（i18n）示例

用法：
  npx tsx examples/i18n.ts [选项]

选项：
  --lang <zh|en>   指定语言模式（默认：zh）
  --help, -h       显示此帮助信息

默认行为：
  自动切换中英文模式，对比框架的本地化能力。
`)
}

// ============================================================
// 演示 1：框架错误信息的本地化
// ============================================================

async function demoFrameworkErrors() {
  console.log("========================================")
  console.log("  演示 1：框架错误信息的本地化")
  console.log("========================================\n")

  // 尝试创建一个不带模型的 Agent，会触发框架内置错误

  console.log("--- 当前语言：zh（中文）---")
  setLocale("zh")

  try {
    // @ts-ignore — 故意不传 model 来触发框架错误
    const bot1 = agent({} as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    await bot1.chat("你好")
  } catch (e: any) {
    console.log("框架错误信息（中文）：")
    console.log(`  → ${e.message}\n`)
  }

  console.log("--- 当前语言：en（英文）---")
  setLocale("en")

  try {
    // @ts-ignore — 故意不传 model 来触发框架错误
    const bot2 = agent({} as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    await bot2.chat("hello")
  } catch (e: any) {
    console.log("框架错误信息（英文）：")
    console.log(`  → ${e.message}\n`)
  }

  // 恢复中文
  setLocale("zh")
}

// ============================================================
// 演示 2：多语言 Agent 对话
// ============================================================

async function demoMultilingualAgent() {
  console.log("========================================")
  console.log("  演示 2：多语言 Agent 对话")
  console.log("========================================\n")

  const tasks = [
    {
      lang: "zh",
      role: "中文助手",
      question: "用一句话介绍什么是 TypeScript",
    },
    {
      lang: "en",
      role: "English Assistant",
      question: "Explain what TypeScript is in one sentence",
    },
    {
      lang: "zh",
      role: "翻译助手",
      question: "把 'The best way to predict the future is to create it' 翻译成中文",
    },
    {
      lang: "en",
      role: "Translation Assistant",
      question: "Translate '大道至简，渐进复杂' into English",
    },
  ]

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    const bot = agent({
      model: "deepseek/deepseek-chat",
      role: task.role,
    })

    console.log(`【${i + 1}/${tasks.length}】${task.lang === "zh" ? "中文" : "English"} — ${task.role}`)
    console.log(`   问题: ${task.question}`)

    const result = await bot.chat(task.question)
    console.log(`   回答: ${result}\n`)
  }
}

// ============================================================
// 演示 3：框架翻译函数 t() 的使用
// ============================================================

function demoTranslationFunction() {
  console.log("========================================")
  console.log("  演示 3：t() 翻译函数")
  console.log("========================================\n")

  // 模拟一个多语言应用中使用 t() 函数
  const messages = {
    welcome: { zh: "欢迎使用 Dao 框架", en: "Welcome to Dao Framework" },
    loading: { zh: "加载中...", en: "Loading..." },
    success: { zh: "操作成功", en: "Operation successful" },
    error: { zh: "出错了：", en: "Error: " },
    footer: {
      zh: "共 {count} 条记录 | 第 {page} 页",
      en: "{count} records total | Page {page}",
    },
  }

  console.log("--- 当前语言：zh ---")
  setLocale("zh")
  console.log(`  welcome → ${t("welcome")}`)
  console.log(`  loading → ${t("loading")}`)
  console.log(`  footer  → ${t("footer", { count: 100, page: 2 })}`)

  console.log("\n--- 当前语言：en ---")
  setLocale("en")
  console.log(`  welcome → ${t("welcome")}`)
  console.log(`  loading → ${t("loading")}`)
  console.log(`  footer  → ${t("footer", { count: 100, page: 2 })}`)

  // 也可以直接用 key 获取翻译
  console.log("\n--- 直接通过 key 获取 ---")
  console.log(`  zh: ${messages.welcome.zh}`)
  console.log(`  en: ${messages.welcome.en}`)

  console.log()
  console.log(`  当前语言: ${getLocale()}`)

  // 恢复中文
  setLocale("zh")
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  const { locale, single } = parseArgs()

  if (single) {
    // 单语言模式
    setLocale(locale)
    console.log(`语言模式：${locale === "zh" ? "中文" : "English"}\n`)

    const bot = agent({
      model: "deepseek/deepseek-chat",
      role: locale === "zh" ? "中文助手" : "English Assistant",
    })

    const question = locale === "zh"
      ? "请用三句话介绍 Dao 框架"
      : "Please introduce the Dao framework in three sentences"

    const result = await bot.chat(question)
    console.log(`回答：${result}`)
    return
  }

  // 默认：完整演示
  await demoFrameworkErrors()
  await demoMultilingualAgent()
  demoTranslationFunction()

  console.log("========================================")
  console.log("  国际化演示完成")
  console.log("========================================\n")
  console.log("当前语言:", getLocale() === "zh" ? "中文" : "English")
  console.log("提示：通过 setLocale('zh'|'en') 随时切换语言")
}

main().catch(console.error)
