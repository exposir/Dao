/**
 * 道（Dao）— 结构化输出示例
 *
 * 使用 generate() 让 Agent 直接返回符合 JSON Schema 的结构化数据。
 * 比 chat() 返回纯文本更可靠，适用于需要程序化处理的场景。
 *
 * 适用场景：
 *   - 数据提取（从文本中提取结构化信息）
 *   - 分类 / 打标
 *   - 参数生成
 *   - API 响应格式化
 *
 * 运行：
 *   npx tsx examples/generate.ts                           # 运行全部演示
 *   npx tsx examples/generate.ts --mode extract            # 仅提取演示
 *   npx tsx examples/generate.ts --mode classify          # 仅分类演示
 *   npx tsx examples/generate.ts --mode code-review       # 仅代码审查评分
 *   npx tsx examples/generate.ts --help                   # 查看帮助
 */

import "dotenv/config"
import { agent } from "dao-ai"

// ============================================================
// CLI 参数解析
// ============================================================

type DemoMode = "all" | "extract" | "classify" | "code-review"

function parseArgs(): DemoMode {
  const args = process.argv.slice(2)
  if (args[0] === "--help" || args[0] === "-h") {
    printHelp()
    process.exit(0)
  }
  const modeMap: Record<string, DemoMode> = {
    "--extract": "extract",
    "--classify": "classify",
    "--code-review": "code-review",
  }
  for (const [flag, mode] of Object.entries(modeMap)) {
    if (args.includes(flag)) return mode
  }
  return "all"
}

function printHelp() {
  console.log(`
结构化输出示例 — generate() 核心用法演示

用法：
  npx tsx examples/generate.ts [选项]

选项：
  --extract       演示：从文本中提取结构化信息（人员/公司/职位）
  --classify     演示：文本分类（情感分析）
  --code-review  演示：代码审查评分（返回 JSON 结构）
  --help, -h     显示此帮助信息

默认行为：
  依次运行全部 3 个演示场景。
`)
}

// ============================================================
// 演示 1：从文本中提取结构化信息
// ============================================================

async function demoExtract() {
  console.log("========================================")
  console.log("  演示 1：信息提取（JSON Schema）")
  console.log("========================================\n")

  const bot = agent({ model: "deepseek/deepseek-chat" })

  const text = `
    张三和李四在 2024 年 3 月 15 日的阿里云开发者大会上相识。
    张三是北京大学的博士，研究方向是分布式系统。
    李四目前在字节跳动担任高级工程师，曾在腾讯工作 3 年。
    大会主题是「AI Native 云原生」，共有 500 人参会。
  `

  console.log("📄 原文：", text.trim(), "\n")

  // 定义输出 schema
  const schema = {
    // 提取的人员列表
    people: [
      {
        name: "姓名",
        education: "最高学历",
        company: "当前公司",
        title: "职位",
        experience: "工作年限（数字）",
      },
    ],
    // 提取的事件
    event: {
      name: "活动名称",
      date: "日期（YYYY-MM-DD）",
      host: "主办方",
      attendeeCount: "参会人数（数字）",
      theme: "主题",
    },
  }

  const result = await bot.generate("extract-entity", {
    schema,
    prompt: [
      `从以下文本中提取结构化信息，返回符合 schema 的 JSON：\n\n${text}`,
      "",
      "要求：",
      "- people 数组中的每个字段都要填写，不知道的写 null",
      "- event 中的日期格式化为 YYYY-MM-DD",
      "- attendeeCount 只填数字",
    ].join("\n"),
  })

  console.log("✅ 提取结果（结构化 JSON）：\n")
  console.log(JSON.stringify(result.object, null, 2))
  console.log(`\n⏱️  耗时: ${result.duration}ms | tokens: ${result.usage.totalTokens}\n`)
}

// ============================================================
// 演示 2：文本分类
// ============================================================

async function demoClassify() {
  console.log("========================================")
  console.log("  演示 2：文本分类")
  console.log("========================================\n")

  const bot = agent({ model: "deepseek/deepseek-chat" })

  const texts = [
    "这部电影太精彩了！剧情紧凑，演员演技炸裂，值得反复观看！",
    "产品体验很差，客服态度恶劣，等了三天才解决问题。",
    "今天天气不错，适合出门散步，心情也跟着好了起来。",
    "股票又跌了，市场情绪低迷，不知道什么时候能反弹。",
  ]

  const sentimentSchema = {
    sentiment: "情感极性：positive / negative / neutral",
    score: "置信度（0-1 之间的小数）",
    keywords: "情感关键词列表",
    summary: "一句话情感摘要",
  }

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i]

    const result = await bot.generate(`classify-${i + 1}`, {
      schema: sentimentSchema,
      prompt: `对以下文本进行情感分析，返回符合 schema 的 JSON：\n\n"${text}"`,
    })

    const data = result.object as any
    const emoji = data.sentiment === "positive" ? "😊"
      : data.sentiment === "negative" ? "😔"
      : "😐"

    console.log(`【${i + 1}】${emoji} ${data.sentiment}（置信度 ${(Number(data.score) * 100).toFixed(0)}%）`)
    console.log(`   关键词: ${(data.keywords as string[]).join(", ")}`)
    console.log(`   摘要: ${data.summary}`)
    console.log()
  }
}

// ============================================================
// 演示 3：代码审查评分
// ============================================================

async function demoCodeReview() {
  console.log("========================================")
  console.log("  演示 3：代码审查评分")
  console.log("========================================\n")

  const bot = agent({ model: "deepseek/deepseek-chat" })

  const code = `
function sum(arr) {
  let total = 0
  for (let i = 0; i < arr.length; i++) {
    total += arr[i]
  }
  return total
}
  `.trim()

  console.log("📄 待审查代码：")
  console.log(code)
  console.log()

  const reviewSchema = {
    score: "综合评分（0-100 的整数）",
    issues: [
      {
        severity: "严重程度：critical / major / minor / suggestion",
        line: "问题所在行号或位置描述",
        type: "问题类型：bug / security / performance / style / type-safety",
        description: "问题描述",
        suggestion: "修复建议",
      },
    ],
    strengths: "代码优点列表",
    overall: "综合评价",
  }

  const result = await bot.generate("code-review", {
    schema: reviewSchema,
    prompt: [
      `请审查以下 TypeScript/JavaScript 代码，返回符合 schema 的 JSON：\n\n${code}`,
      "",
      "评分标准：",
      "- 0-30：存在严重 bug 或安全问题",
      "- 31-60：有明显可改进之处",
      "- 61-80：代码可用，有少量优化空间",
      "- 81-100：高质量代码",
    ].join("\n"),
  })

  const data = result.object as any

  console.log("📊 综合评分：", data.score, "/ 100")
  console.log()

  if (data.issues?.length > 0) {
    console.log("🐛 发现问题：")
    for (const issue of data.issues) {
      const icon = issue.severity === "critical" ? "🔴"
        : issue.severity === "major" ? "🟡"
        : "🔵"
      console.log(`  ${icon} [${issue.severity}] ${issue.type}`)
      console.log(`     位置: ${issue.line}`)
      console.log(`     问题: ${issue.description}`)
      console.log(`     建议: ${issue.suggestion}`)
    }
    console.log()
  }

  if (data.strengths) {
    console.log("✨ 优点：", data.strengths)
    console.log()
  }

  console.log("💬 综合评价：", data.overall)
  console.log(`\n⏱️  耗时: ${result.duration}ms | tokens: ${result.usage.totalTokens}\n`)
}

// ============================================================
// 演示 4：参数生成（实际应用场景）
// ============================================================

async function demoParamGeneration() {
  console.log("========================================")
  console.log("  演示 4：API 参数生成")
  console.log("========================================\n")

  const bot = agent({ model: "deepseek/deepseek-chat" })

  const userRequest = "帮我查询今天北京的天气，空气质量 PM2.5 指数，以及未来三天的预报"

  console.log("💬 用户请求：", userRequest, "\n")

  const paramSchema = {
    // 天气查询参数
    weather: {
      city: "城市名称",
      country: "国家代码（ISO 3166-1 alpha-2）",
    },
    // 空气质量参数
    airQuality: {
      city: "城市名称",
      includeForecast: "是否包含预报（布尔值）",
    },
    // 语言偏好
    language: "返回语言（zh-CN / en-US）",
    // 是否有错误
    error: "错误信息（无错误则为 null）",
  }

  const result = await bot.generate("api-params", {
    schema: paramSchema,
    prompt: `将以下自然语言请求转化为 API 调用参数，返回符合 schema 的 JSON：\n\n"${userRequest}"`,
  })

  console.log("⚙️  生成的结构化参数：\n")
  console.log(JSON.stringify(result.object, null, 2))

  // 实际应用中可以直接用这些参数调用 API
  const params = result.object as any
  if (params.error) {
    console.log("\n❌ 参数生成失败：", params.error)
  } else {
    console.log("\n✅ 参数验证通过，可直接用于 API 调用")
    console.log("   天气 API 调用参数：", JSON.stringify(params.weather))
    console.log("   空气质量 API 调用参数：", JSON.stringify(params.airQuality))
  }

  console.log(`\n⏱️  耗时: ${result.duration}ms\n`)
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  console.log("========================================")
  console.log("  Dao — 结构化输出示例")
  console.log("  generate() 让 Agent 返回 JSON Schema")
  console.log("========================================\n")

  const mode = parseArgs()

  const demos: Array<{ name: string; fn: () => Promise<void> }> = [
    { name: "信息提取", fn: demoExtract },
    { name: "文本分类", fn: demoClassify },
    { name: "代码审查评分", fn: demoCodeReview },
    { name: "API 参数生成", fn: demoParamGeneration },
  ]

  for (const demo of demos) {
    if (mode !== "all") {
      const modeToName: Record<string, string> = {
        extract: "信息提取",
        classify: "文本分类",
        "code-review": "代码审查评分",
      }
      if (demo.name !== modeToName[mode]) continue
    }

    try {
      await demo.fn()
    } catch (err: any) {
      console.error(`❌ ${demo.name}演示失败：${err.message}\n`)
    }
  }

  console.log("========================================")
  console.log("  演示完成")
  console.log("========================================\n")
  console.log("generate() 的优势 vs chat()：")
  console.log("  ✅ 输出格式固定，程序易解析")
  console.log("  ✅ 字段完整，不遗漏关键信息")
  console.log("  ✅ 可直接用于后续 API 调用、数据库写入")
  console.log("  ✅ 比正则/字符串解析更可靠")
}

main().catch(err => {
  console.error(`\n❌ 示例运行失败：${err.message}`)
  process.exit(1)
})
