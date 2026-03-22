/**
 * 道（Dao）— Steps 引擎
 *
 * 执行声明式步骤序列：
 * - 字符串步骤 → 作为任务描述发送给 Agent
 * - 并行步骤 → Promise.allSettled 并行执行（单个失败不影响其他）
 * - 条件步骤 → 根据条件选择执行分支
 * - 函数步骤 → 直接执行回调
 */

import type {
  Step,
  TaskStep,
  WaitStep,
  ParallelStep,
  ConditionalStep,
  StepContext,
  AgentInstance,
  RunResult,
} from "./core/types.js"

/** 步骤执行结果 */
export interface StepResult {
  step: Step
  result: any
}

/**
 * 执行单个字符串任务的回调（由 agent.ts 提供，直接走 runLoop 跳过 steps）
 */
export type ExecuteTaskFn = (task: string) => Promise<RunResult>

/**
 * 执行步骤序列
 */
export async function runSteps(
  steps: Step[],
  agent: AgentInstance,
  executeTask: ExecuteTaskFn,
  initialResult?: any,
  onStepStart?: (step: Step, index: number) => void,
  onStepEnd?: (step: Step, index: number, result: any) => void,
  onWait?: () => Promise<any>,
): Promise<StepResult[]> {
  const history: StepResult[] = []
  let lastResult: any = initialResult ?? null

  const ctx: StepContext = {
    lastResult: null,
    history: [],
    agent,
    abort: (reason?: string) => {
      throw new AbortError(reason ?? "步骤执行被中止")
    },
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    onStepStart?.(step, i)

    // 更新上下文
    ctx.lastResult = lastResult
    ctx.history = history.map(h => ({ step: h.step, result: h.result }))

    try {
      const result = await executeStep(step, ctx, executeTask, onWait)
      lastResult = result
      history.push({ step, result })
      await onStepEnd?.(step, i, result)
    } catch (err) {
      // AbortError 由用户显式调用 ctx.abort()，应该中断整个流程
      if (err instanceof AbortError) throw err
      // 其他错误：记录失败，继续下一步
      const errorResult = { error: err instanceof Error ? err.message : String(err) }
      lastResult = errorResult
      history.push({ step, result: errorResult })
      await onStepEnd?.(step, i, errorResult)
    }
  }

  return history
}

/**
 * 执行单个步骤
 */
async function executeStep(step: Step, ctx: StepContext, executeTask: ExecuteTaskFn, onWait?: () => Promise<any>): Promise<any> {
  // 字符串步骤：拼接上一步结果
  if (typeof step === "string") {
    let prompt = step
    if (ctx.lastResult != null && ctx.lastResult !== "") {
      const lastStr = typeof ctx.lastResult === "string" ? ctx.lastResult : JSON.stringify(ctx.lastResult)
      prompt = `上一步的执行结果：\n${lastStr}\n\n当前步骤：${step}`
    }
    const result = await executeTask(prompt)
    return result.output
  }

  // 函数步骤
  if (typeof step === "function") {
    return await step(ctx)
  }

  // WaitStep
  if (isWaitStep(step)) {
    if (!onWait) {
      throw new Error("wait 步骤需要 resume() 支持，请通过 agent 实例调用")
    }
    return await onWait()
  }

  // TaskStep
  if (isTaskStep(step)) {
    return await executeTaskStep(step, executeTask, ctx)
  }

  // 并行步骤
  if (isParallelStep(step)) {
    return await executeParallel(step, ctx, executeTask)
  }

  // 条件步骤
  if (isConditionalStep(step)) {
    return await executeConditional(step, ctx, executeTask)
  }

  throw new Error(`未知的步骤类型: ${JSON.stringify(step)}`)
}

/**
 * 并行执行多个子步骤
 */
async function executeParallel(step: ParallelStep, ctx: StepContext, executeTask: ExecuteTaskFn): Promise<any[]> {
  const concurrency = Math.max(1, step.concurrency ?? Infinity)
  const tasks = step.parallel

  /** 将 allSettled 结果提取为值或错误对象 */
  function extractResults(settled: PromiseSettledResult<any>[]): any[] {
    return settled.map(r =>
      r.status === "fulfilled" ? r.value : { error: r.reason?.message ?? String(r.reason) }
    )
  }

  if (concurrency >= tasks.length) {
    // 无限制，全部并行
    const settled = await Promise.allSettled(
      tasks.map(subStep => executeStep(subStep as Step, ctx, executeTask))
    )
    return extractResults(settled)
  }

  // 分批执行，同时最多 concurrency 个
  const results: any[] = []
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency)
    const settled = await Promise.allSettled(
      batch.map(subStep => executeStep(subStep as Step, ctx, executeTask))
    )
    results.push(...extractResults(settled))
  }
  return results
}

/**
 * 条件执行
 */
async function executeConditional(step: ConditionalStep, ctx: StepContext, executeTask: ExecuteTaskFn): Promise<any> {
  const maxAttempts = (step.retry ?? 0) + 1
  let lastResult: any = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let condition: boolean

    try {
      if (typeof step.if === "string") {
        // 字符串条件 → 让 Agent 判断（只调用底层单轮查询，不落入 memory）
        const answerResult = await executeTask(
          `请判断以下条件是否成立，并联系上文只回答"YES"或"NO"：${step.if}`
        )
        const answer = answerResult.output
        const normalized = answer.trim().toUpperCase()
        // 先检查否定，再检查肯定
        const isNo = /\b(NO|FALSE)\b/.test(normalized) || /^(否|不是|没有|不)/.test(answer.trim())
        const isYes = /\b(YES|TRUE)\b/.test(normalized) || /^(是|有|对)/.test(answer.trim())
        condition = isYes && !isNo
      } else {
        // 函数条件 → 直接执行
        condition = await step.if(ctx)
      }
    } catch (err) {
      if (err instanceof AbortError) throw err
      // 条件评估失败，视为 false
      condition = false
    }

    if (condition) {
      // 条件为 YES → 执行 then 分支
      if (step.then) {
        try {
          lastResult = await executeStep(step.then as Step, ctx, executeTask)
        } catch (err) {
          if (err instanceof AbortError) throw err
          lastResult = { error: (err as Error).message }
        }
      }
      // 如果还有重试次数，继续循环重新评估条件
      continue
    } else {
      // 条件为 NO → 执行 else 分支（如有）并结束
      if (step.else) {
        return await executeStep(step.else as Step, ctx, executeTask)
      }
      return lastResult
    }
  }

  // 达到最大重试次数，条件仍为 YES → 返回最后一次 then 的结果
  return lastResult
}

/** 类型守卫 */
function isWaitStep(step: any): step is WaitStep {
  return step && typeof step === "object" && step.wait === true
}

function isTaskStep(step: any): step is TaskStep {
  return step && typeof step === "object" && typeof step.task === "string" && !("parallel" in step) && !("if" in step)
}

function isParallelStep(step: any): step is ParallelStep {
  return step && typeof step === "object" && Array.isArray(step.parallel)
}

function isConditionalStep(step: any): step is ConditionalStep {
  return step && typeof step === "object" && "if" in step && "then" in step
}

/**
 * 执行 TaskStep（带 output 预期 + validate 校验 + maxRetries 重试）
 */
async function executeTaskStep(step: TaskStep, executeTask: ExecuteTaskFn, ctx?: StepContext): Promise<string> {
  // 拼装 prompt：task + lastResult + output 预期
  let prompt = step.task
  if (ctx?.lastResult != null && ctx.lastResult !== "") {
    const lastStr = typeof ctx.lastResult === "string" ? ctx.lastResult : JSON.stringify(ctx.lastResult)
    prompt = `上一步的执行结果：\n${lastStr}\n\n当前步骤：${prompt}`
  }
  if (step.output) {
    prompt += `\n\n期望输出：${step.output}`
  }

  const maxAttempts = (step.maxRetries ?? 0) + 1
  let lastFeedback = ""

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await executeTask(
      attempt === 0
        ? prompt
        : `${prompt}\n\n上次输出未通过校验，原因：${lastFeedback}\n请重新生成。`
    )

    // 无校验函数，直接返回
    if (!step.validate) {
      return result.output
    }

    // 校验
    const validation = step.validate(result.output)
    if (validation === true) {
      return result.output
    }

    // 校验失败
    lastFeedback = typeof validation === "string" ? validation : "输出格式不符合要求"

    // 最后一次尝试仍失败，返回结果（不抛错）
    if (attempt === maxAttempts - 1) {
      return result.output
    }
  }

  // 不会到这里，但 TypeScript 需要
  return ""
}

/** 中止错误 */
export class AbortError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AbortError"
  }
}
