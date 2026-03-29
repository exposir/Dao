/**
 * 道（Dao）— 批量任务 + 失败重试
 *
 * 演示两种常见场景：
 *   1. 并发执行 N 个任务（限制并发数，避免压垮 API）
 *   2. 只重试失败的任务，保留成功结果
 *
 * 运行：
 *   npx tsx examples/batch.ts
 */

import "dotenv/config"
import { agent } from "dao-ai"

// ============================================================
// 工具函数：并发控制
// ============================================================

/**
 * 并发限制器。
 * 不依赖任何外部库，纯 Promise 实现。
 *
 * @param tasks 任务列表（返回 Promise 的函数）
 * @param limit 同时执行的最大任务数
 * @param onProgress 每个任务完成时的回调（成功/失败标记）
 */
async function concurrentBatch<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
  onProgress?: (index: number, success: boolean, result: T | unknown) => void
): Promise<Array<{ success: boolean; result: T | unknown }>> {
  const results: Array<{ success: boolean; result: T | unknown }> = []
  let taskIndex = 0

  async function worker() {
    while (taskIndex < tasks.length) {
      const current = taskIndex++
      const task = tasks[current]

      try {
        const result = await task()
        results[current] = { success: true, result }
        onProgress?.(current, true, result)
      } catch (err) {
        results[current] = { success: false, result: err }
        onProgress?.(current, false, err)
      }
    }
  }

  // 启动 limit 个并发 worker
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()))

  return results
}

// ============================================================
// 示例数据：批量翻译任务
// ============================================================

interface TranslateTask {
  id: number
  text: string
  targetLang: string
}

const tasks: TranslateTask[] = [
  { id: 1, text: "你好，世界！", targetLang: "English" },
  { id: 2, text: "人工智能正在改变世界", targetLang: "English" },
  { id: 3, text: "TypeScript 让代码更健壮", targetLang: "English" },
  { id: 4, text: "开源社区推动技术进步", targetLang: "English" },
  { id: 5, text: "大道至简，渐进复杂", targetLang: "English" },
  { id: 6, text: "你好，世界！", targetLang: "Japanese" },
  { id: 7, text: "人工智能正在改变世界", targetLang: "Japanese" },
  { id: 8, text: "TypeScript 让代码更健壮", targetLang: "Japanese" },
  { id: 9, text: "开源社区推动技术进步", targetLang: "Japanese" },
  { id: 10, text: "大道至简，渐进复杂", targetLang: "Japanese" },
]

// ============================================================
// 翻译 Agent（共享实例，节省模型初始化）
// ============================================================

const translator = agent({
  model: "deepseek/deepseek-chat",
  role: "专业翻译",
  rules: {
    reject: ["意译", "添加内容", "删除内容"],
  },
  maxTurns: 3,
})

// ============================================================
// 主流程
// ============================================================

async function main() {
  console.log(`=== 批量翻译 ${tasks.length} 个任务 ===\n`)

  const CONCURRENCY = 3
  const MAX_RETRIES = 2

  // --- 第一轮：并发执行 ---
  console.log(`【第一轮】并发数=${CONCURRENCY}，全部任务\n`)

  const pendingTasks = [...tasks]
  const completed: Array<{ id: number; result: string | unknown }> = []
  const failed: Array<{ task: TranslateTask; attempt: number }> = []

  let successCount = 0

  const results = await concurrentBatch(
    pendingTasks.map((t, i) => async () => {
      const res = await translator.run(
        `将以下文本翻译成${t.targetLang}，只输出译文：${t.text}`
      )
      return { id: t.id, result: res.output }
    }),
    CONCURRENCY,
    (index, success, result) => {
      if (success) {
        successCount++
        completed.push(result as { id: number; result: string })
        process.stdout.write(".")
      } else {
        process.stdout.write("F")
      }
    }
  )

  console.log(`\n\n第一轮完成：✅ ${successCount} 成功 | ❌ ${tasks.length - successCount} 失败\n`)

  // --- 重试失败的 ---
  const failureIndices = results
    .map((r, i) => (!r.success ? i : -1))
    .filter(i => i >= 0)

  for (const idx of failureIndices) {
    failed.push({ task: pendingTasks[idx], attempt: 1 })
  }

  for (let retryRound = 1; retryRound <= MAX_RETRIES && failed.length > 0; retryRound++) {
    const toRetry = [...failed.filter(f => f.attempt === retryRound)]
    console.log(`\n【重试第 ${retryRound} 轮】${toRetry.length} 个任务\n`)

    const retryResults = await concurrentBatch(
      toRetry.map(f => async () => {
        const res = await translator.run(
          `将以下文本翻译成${f.task.targetLang}，只输出译文：${f.task.text}`
        )
        return { id: f.task.id, result: res.output }
      }),
      CONCURRENCY,
      (_index, success) => {
        process.stdout.write(success ? "." : "F")
      }
    )

    retryResults.forEach((r, i) => {
      if (r.success) {
        successCount++
        completed.push(r.result as { id: number; result: string })
        console.log(`\n  ✅ 任务 ${toRetry[i].task.id} 翻译成功`)
      } else {
        console.error(`\n  ❌ 任务 ${toRetry[i].task.id} 第 ${retryRound} 轮仍失败`)
        if (retryRound < MAX_RETRIES) {
          failed.push({ task: toRetry[i].task, attempt: retryRound + 1 })
        }
      }
    })
  }

  // --- 输出汇总 ---
  console.log("\n\n=== 最终汇总 ===")
  console.log(`总任务: ${tasks.length}`)
  console.log(`成功: ${successCount}`)
  console.log(`失败: ${tasks.length - successCount}`)
  console.log("\n--- 翻译结果 ---")
  for (const c of completed) {
    const task = tasks.find(t => t.id === c.id)
    console.log(`[${task?.targetLang}] "${task?.text}" → "${(c.result as string).slice(0, 60)}"`)
  }
}

main().catch(console.error)
