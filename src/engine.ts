/**
 * 道（Dao）— Steps 引擎
 *
 * 执行声明式步骤序列：
 * - 字符串步骤 → 作为任务描述发送给 Agent
 * - 并行步骤 → Promise.all 并行执行
 * - 条件步骤 → 根据条件选择执行分支
 * - 函数步骤 → 直接执行回调
 */

import type {
  Step,
  ParallelStep,
  ConditionalStep,
  StepContext,
  AgentInstance,
  RunResult,
} from "./types.js"

/** 步骤执行结果 */
export interface StepResult {
  step: Step
  result: any
}

/**
 * 执行步骤序列
 */
export async function runSteps(
  steps: Step[],
  agent: AgentInstance,
  onStepStart?: (step: Step, index: number) => void,
  onStepEnd?: (step: Step, index: number, result: any) => void,
): Promise<StepResult[]> {
  const history: StepResult[] = []
  let lastResult: any = null

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

    const result = await executeStep(step, ctx)
    lastResult = result

    history.push({ step, result })
    onStepEnd?.(step, i, result)
  }

  return history
}

/**
 * 执行单个步骤
 */
async function executeStep(step: Step, ctx: StepContext): Promise<any> {
  // 字符串步骤 → 发送给 Agent
  if (typeof step === "string") {
    const result = await ctx.agent.run(step)
    return result.output
  }

  // 函数步骤 → 直接执行
  if (typeof step === "function") {
    return await step(ctx)
  }

  // 并行步骤
  if (isParallelStep(step)) {
    return await executeParallel(step, ctx)
  }

  // 条件步骤
  if (isConditionalStep(step)) {
    return await executeConditional(step, ctx)
  }

  throw new Error(`未知的步骤类型: ${JSON.stringify(step)}`)
}

/**
 * 并行执行多个子步骤
 */
async function executeParallel(step: ParallelStep, ctx: StepContext): Promise<any[]> {
  const tasks = step.parallel.map(subStep => executeStep(subStep as Step, ctx))
  return await Promise.all(tasks)
}

/**
 * 条件执行
 */
async function executeConditional(step: ConditionalStep, ctx: StepContext): Promise<any> {
  let condition: boolean

  if (typeof step.if === "string") {
    // 字符串条件 → 让 Agent 判断
    const answer = await ctx.agent.chat(
      `请判断以下条件是否成立，只回答"是"或"否"：${step.if}`
    )
    condition = answer.includes("是")
  } else {
    // 函数条件 → 直接执行
    condition = await step.if(ctx)
  }

  const branch = condition ? step.then : step.else
  if (!branch) return null

  // 支持重试
  let lastError: any
  const maxAttempts = (step.retry ?? 0) + 1

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await executeStep(branch as Step, ctx)
    } catch (err) {
      lastError = err
      if (err instanceof AbortError) throw err
    }
  }

  throw lastError
}

/** 类型守卫 */
function isParallelStep(step: any): step is ParallelStep {
  return step && typeof step === "object" && Array.isArray(step.parallel)
}

function isConditionalStep(step: any): step is ConditionalStep {
  return step && typeof step === "object" && "if" in step && "then" in step
}

/** 中止错误 */
export class AbortError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AbortError"
  }
}
