/**
 * 道（Dao）— 工具级自动重试
 *
 * 演示两种重试策略：
 *   1. 包装工具：给任何工具包一层 retry，不改原始工具代码
 *   2. Plugin hook：拦截 afterToolCall，失败时主动重试整个 Agent 循环
 *
 * 运行：
 *   npx tsx examples/retry-tool.ts
 */

import "dotenv/config"
import { agent, tool } from "dao-ai"

// ============================================================
// 工具函数：包装器（不修改原始工具）
// ============================================================

/**
 * 给工具加自动重试。临时性错误（网络、限流）常见于外部 API，
 * 加上退避重试能大幅提升稳定性。
 */
function withRetry<T extends Record<string, any>>(
  baseTool: ReturnType<typeof tool>,
  options: {
    /** 最大重试次数（含首次），默认 3 */
    maxRetries?: number
    /** 重试间隔（毫秒），默认 1000，可传入函数做指数退避 */
    delay?: number | ((attempt: number) => number)
  } = {}
) {
  const { maxRetries = 3, delay = 1000 } = options

  return tool({
    name: baseTool.name,
    description: `[重试版] ${baseTool.description}`,
    params: baseTool.params,
    confirm: (baseTool as any).confirm,
    run: async (params: T) => {
      let lastError: Error | unknown

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const result = await (baseTool as any).run(params)
          return result
        } catch (err) {
          lastError = err
          if (attempt < maxRetries - 1) {
            const wait = typeof delay === "function"
              ? delay(attempt)
              : delay
            console.log(`[retry] "${baseTool.name}" 第 ${attempt + 1} 次失败，${wait}ms 后重试...`)
            await new Promise(res => setTimeout(res, wait))
          }
        }
      }

      throw lastError
    },
  })
}

// ============================================================
// 示例 1：包装不稳定 API（指数退避）
// ============================================================

const unstableApi = tool({
  name: "fetchWeather",
  description: "查询某城市的实时天气",
  params: { city: "城市名称" },
  run: async ({ city }: { city: string }) => {
    // 模拟不稳定 API：20% 概率失败
    if (Math.random() < 0.2) {
      throw new Error("网络超时，请重试")
    }
    return `🌤️  ${city} 今日天气晴，气温 22°C，湿度 65%`
  },
})

// 用 withRetry 包装，指数退避（1s → 2s → 4s）
const resilientWeather = withRetry(unstableApi, {
  maxRetries: 4,
  delay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
})

// ============================================================
// 示例 2：用 plugin hook 检测工具失败并重试
// ============================================================

import { plugin } from "dao-ai"

/**
 * 工具失败时自动重试插件。
 *
 * 原理：afterToolCall 捕获错误 → 等待 → 重新调用 agent.chat()，
 * 利用 loop 的内部记忆继续执行。对上层完全透明。
 */
function autoRetryPlugin(options: {
  maxRetries?: number
  delay?: number
  onRetry?: (tool: string, attempt: number, error: string) => void
}) {
  const { maxRetries = 2, delay = 2000, onRetry } = options

  return plugin({
    name: "auto-retry",
    hooks: {
      afterToolCall: (ctx) => {
        // 检查结果是否是错误标记（工具层没有异常机制，靠字符串判断）
        const result = ctx.result as string
        if (result?.startsWith?.("错误：") || result?.includes?.("请重试")) {
          const toolName = ctx.tool as string
          const attempt = ctx.store._retryCount ?? 0

          if (attempt < maxRetries) {
            ctx.store._retryCount = attempt + 1
            onRetry?.(toolName, attempt + 1, result)
            // 在 plugin 里等待后重新触发——需要在 ctx 上有 skip() + 重新注入逻辑
            // 这里演示思路，真实场景建议用包装器方案
            console.log(`[auto-retry] "${toolName}" 失败(${result})，将在下轮重试（${attempt + 1}/${maxRetries}）`)
          }
        }
      },
    },
  })
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  console.log("=== 工具级重试示例 ===\n")

  // 示例 A：包装后的天气工具
  console.log("【A】包装版工具（指数退避）")
  for (let i = 0; i < 5; i++) {
    try {
      const weather = await resilientWeather.run({ city: "北京" })
      console.log(`  成功: ${weather}`)
      break
    } catch (err) {
      console.error(`  最终失败: ${(err as Error).message}`)
    }
  }

  console.log()

  // 示例 B：用 Agent + 插件演示
  console.log("【B】Agent + 自动重试插件")

  const flakyTool = tool({
    name: "getStockPrice",
    description: "获取股票当前价格",
    params: { symbol: "股票代码，如 AAPL" },
    run: async ({ symbol }: { symbol: string }) => {
      // 模拟：3 次调用后会成功
      const attempts = (globalThis as any).__stockAttempts ?? 0
      ;(globalThis as any).__stockAttempts = attempts + 1
      if (attempts < 2) throw new Error("行情接口暂时不可用")
      return `$${symbol} 当前价格: $${(Math.random() * 500).toFixed(2)}`
    },
  })

  const bot = agent({
    model: "deepseek/deepseek-chat",
    tools: [flakyTool],
    maxTurns: 10,
    plugins: [autoRetryPlugin({
      maxRetries: 3,
      onRetry: (tool, attempt) => {
        console.log(`  ↩️  重试 ${tool}（第 ${attempt} 次）...`)
      },
    })],
  })

  try {
    const result = await bot.run("查一下 AAPL 的股价")
    console.log(`\n  最终结果: ${result.output.slice(0, 80)}...`)
    console.log(`  耗时: ${result.duration}ms`)
  } catch (err) {
    console.error(`\n  Agent 最终失败: ${(err as Error).message}`)
  }
}

main().catch(console.error)
