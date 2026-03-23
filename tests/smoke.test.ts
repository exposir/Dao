/**
 * 端到端 Smoke Test — 使用真实 DeepSeek 模型
 *
 * 需要 .env 中配置 DEEPSEEK_API_KEY
 * 运行: npx vitest run tests/smoke.test.ts
 */

import { describe, it, expect, beforeAll } from "vitest"
import { agent, tool, plugin, team, configure } from "../src/index.js"
import type { RunResult, RunEvent, TokenUsage } from "../src/core/types.js"
import "dotenv/config"

const MODEL = "deepseek/deepseek-chat"
const hasKey = !!process.env.DEEPSEEK_API_KEY

// 网络可达性预检：HEAD 请求 DeepSeek API，3 秒超时
let networkOk = false
if (hasKey) {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 3000)
    await fetch("https://api.deepseek.com", {
      method: "HEAD",
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer))
    networkOk = true
  } catch {
    // DNS/网络不可达，跳过 E2E
  }
}

// 跳过条件：无 API Key 或网络不可达时整组跳过
const describeE2E = hasKey && networkOk ? describe : describe.skip

describeE2E("E2E: chat()", () => {
  it("应该返回非空字符串", async () => {
    const bot = agent({ model: MODEL })
    const reply = await bot.chat("用一句话介绍自己，不超过 20 个字")

    expect(typeof reply).toBe("string")
    expect(reply.length).toBeGreaterThan(0)
  }, 30000)

  it("memory 模式应该记住上下文", async () => {
    const bot = agent({ model: MODEL, memory: true })
    await bot.chat("我的名字叫小明，请记住")
    const reply = await bot.chat("我叫什么名字？")

    expect(reply).toContain("小明")
  }, 30000)
})

describeE2E("E2E: run()", () => {
  it("应该返回完整 RunResult 结构", async () => {
    const bot = agent({ model: MODEL })
    const result = await bot.run("回答：1+1=？只输出数字")

    expect(result).toHaveProperty("output")
    expect(result).toHaveProperty("usage")
    expect(result).toHaveProperty("duration")
    expect(result.output).toContain("2")
    expect(result.usage.totalTokens).toBeGreaterThan(0)
    expect(result.duration).toBeGreaterThan(0)
  }, 30000)
})

describeE2E("E2E: chatStream()", () => {
  it("应该逐块输出文本", async () => {
    const bot = agent({ model: MODEL })
    const chunks: string[] = []

    for await (const chunk of bot.chatStream("说'你好'两个字")) {
      chunks.push(chunk)
    }

    expect(chunks.length).toBeGreaterThan(0)
    const full = chunks.join("")
    expect(full).toContain("你好")
  }, 30000)
})

describeE2E("E2E: runStream()", () => {
  it("应该发出 text 和 done 事件", async () => {
    const bot = agent({ model: MODEL })
    const events: RunEvent[] = []

    for await (const event of bot.runStream("回答：中国首都是哪里？只说城市名")) {
      events.push(event)
    }

    const textEvents = events.filter(e => e.type === "text")
    const doneEvents = events.filter(e => e.type === "done")

    expect(textEvents.length).toBeGreaterThan(0)
    expect(doneEvents).toHaveLength(1)

    // done 事件应该携带 usage
    const doneData = doneEvents[0].data as { usage?: TokenUsage } | null
    expect(doneData).not.toBeNull()
    expect(doneData?.usage?.totalTokens).toBeGreaterThan(0)

    const fullText = textEvents.map(e => e.data).join("")
    expect(fullText).toContain("北京")
  }, 30000)
})

describeE2E("E2E: tool 调用", () => {
  it("agent 应该正确调用工具", async () => {
    let toolCalled = false
    const calculator = tool({
      name: "calculator",
      description: "计算数学表达式",
      params: { expression: "数学表达式，如 2+3" },
      run: ({ expression }) => {
        toolCalled = true
        try {
          return String(eval(expression))
        } catch {
          return "计算错误"
        }
      },
    })

    const bot = agent({
      model: MODEL,
      role: "数学助手",
      tools: [calculator],
    })

    const result = await bot.run("用 calculator 工具计算 15 * 7 的结果，然后直接告诉我答案数字")
    expect(toolCalled).toBe(true)
    expect(result.output).toContain("105")
  }, 30000)
})

describeE2E("E2E: plugin 生命周期", () => {
  it("插件 hooks 应该按顺序触发", async () => {
    const hookLog: string[] = []

    const tracker = plugin({
      name: "tracker",
      hooks: {
        beforeInput: () => { hookLog.push("beforeInput") },
        beforeModelCall: () => { hookLog.push("beforeModelCall") },
        afterModelCall: (ctx: any) => {
          hookLog.push("afterModelCall")
          // 验证 response 结构
          expect(ctx.response).toHaveProperty("text")
          expect(ctx.response).toHaveProperty("usage")
        },
        onComplete: (ctx: any) => {
          hookLog.push("onComplete")
          expect(ctx.result.duration).toBeGreaterThan(0)
          expect(ctx.result.usage.totalTokens).toBeGreaterThan(0)
        },
      },
    })

    const bot = agent({
      model: MODEL,
      plugins: [tracker],
    })

    await bot.chat("说'OK'")

    expect(hookLog).toContain("beforeInput")
    expect(hookLog).toContain("beforeModelCall")
    expect(hookLog).toContain("afterModelCall")
    expect(hookLog).toContain("onComplete")
    // 顺序验证
    expect(hookLog.indexOf("beforeInput")).toBeLessThan(hookLog.indexOf("beforeModelCall"))
    expect(hookLog.indexOf("beforeModelCall")).toBeLessThan(hookLog.indexOf("afterModelCall"))
    expect(hookLog.indexOf("afterModelCall")).toBeLessThan(hookLog.indexOf("onComplete"))
  }, 30000)
})

describeE2E("E2E: steps 引擎", () => {
  it("多步骤应该按顺序执行并传递上下文", async () => {
    const bot = agent({
      model: MODEL,
      steps: [
        "列出 3 个水果名称，用逗号分隔，不要其他内容",
        "把上一步提到的水果翻译成英文，用逗号分隔，不要其他内容",
      ],
    })

    const result = await bot.run("开始")

    expect(result.output.length).toBeGreaterThan(0)
    expect(result.turns.length).toBe(2)
    expect(result.usage.totalTokens).toBeGreaterThan(0)
  }, 60000)
})

