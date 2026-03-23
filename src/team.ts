/**
 * 道（Dao）— Team 系统
 *
 * team() 创建多 Agent 协作团队。
 * lead Agent 自动获得 delegate 工具，可调度其他 member 执行任务。
 */

import type {
  TeamOptions,
  TeamInstance,
  TeamRunResult,
  TeamRunEvent,
  AgentInstance,
  RunResult,
} from "./core/types.js"
import { tool } from "./tool.js"

/** 安全深拷贝，防止 BigInt / 循环引用导致 JSON.parse(JSON.stringify(...)) 崩溃 */
function safeDeepCopy<T>(value: T): T {
  try {
    return structuredClone(value)
  } catch {
    // structuredClone 也失败时（如含函数引用），退化为浅层数组拷贝
    if (value && typeof value === "object") {
      const copy: any = {}
      for (const [k, v] of Object.entries(value)) {
        copy[k] = Array.isArray(v) ? [...v] : v
      }
      return copy as T
    }
    return value
  }
}
import { agent } from "./agent.js"

/**
 * 创建一个多 Agent 团队
 *
 * @example
 * ```typescript
 * const planner = agent({ role: "架构师", model: "deepseek/deepseek-chat" })
 * const coder = agent({ role: "开发者", tools: [readFile, writeFile] })
 * const tester = agent({ role: "测试", tools: [runCommand] })
 *
 * const squad = team({
 *   members: { planner, coder, tester },
 * })
 * const result = await squad.run("添加用户登录功能")
 * ```
 *
 * **注意：** 返回的 TeamInstance 不支持并发调用 `run()` / `runStream()`，
 * 同一时间只能执行一个任务。并发调用会导致 memberResults 和流式事件互相污染。
 */
export function team(options: TeamOptions): TeamInstance {
  const { members, lead, strategy = "auto", maxRounds, plugins } = options

  // 构建 member 描述，供 lead Agent 了解团队能力
  const memberDescriptions = Object.entries(members)
    .map(([name, member]) => {
      const config = member.getConfig()
      return `- **${name}**: ${config.role ?? "通用 Agent"}`
    })
    .join("\n")

  // 用闭包收集 member 执行结果 (改为每个实例方法内重置或传递)
  const memberResults: Record<string, RunResult[]> = {}
  for (const name of Object.keys(members)) {
    memberResults[name] = []
  }

  // 用于 stream 时的事件合并（ref 对象，runStream 期间设置回调，结束后清空）
  const streamRef: { yieldCb: ((event: TeamRunEvent) => void) | null } = { yieldCb: null }

  // 为 lead 创建 delegate 工具
  const delegateTool = tool({
    name: "delegate",
    description:
      `将任务委派给团队成员执行。可用成员：\n${memberDescriptions}\n` +
      `使用 member 参数指定成员名称，task 参数描述要执行的任务。`,
    params: {
      member: "团队成员名称",
      task: "要委派的任务描述",
    },
    run: async ({ member: memberName, task }) => {
      const memberAgent = members[memberName]
      if (!memberAgent) {
        return `错误：成员 "${memberName}" 不存在。可用成员：${Object.keys(members).join(", ")}`
      }

      try {
        if (streamRef.yieldCb) {
          const yieldCb = streamRef.yieldCb
          let fullOutput = ""
          let lastUsage = undefined
          const memberStart = Date.now()
          for await (const event of memberAgent.runStream(task)) {
             yieldCb({ ...event, member: memberName } as TeamRunEvent)
             if (event.type === "text") fullOutput += event.data
             if (event.type === "done" && event.data?.usage) {
               lastUsage = event.data.usage
             }
          }
          const res: RunResult = {
             output: fullOutput,
             turns: [],
             usage: lastUsage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
             duration: Date.now() - memberStart,
          }
          memberResults[memberName].push(res)
          return fullOutput
        } else {
          const result = await memberAgent.run(task)
          memberResults[memberName].push(result)
          return result.output
        }
      } catch (err: any) {
        return `成员 "${memberName}" 执行失败：${err.message}`
      }
    },
  })

  // 创建 lead Agent
  let leadAgent: AgentInstance

  if (lead) {
    // 用户提供了 lead，注入 delegate 工具但不破坏原 prompt 结构
    const config = lead.getConfig()
    const extraPrompt = `\n\n你可以使用 delegate 工具委派任务给团队成员。\n团队成员：\n${memberDescriptions}`
    
    leadAgent = agent({
      ...config,
      maxTurns: maxRounds ?? config.maxTurns ?? 20,
      plugins: plugins ? [...(config.plugins ?? []), ...plugins] : config.plugins,
      tools: [...(config.tools ?? []), delegateTool],
      systemPrompt: config.systemPrompt ? config.systemPrompt + extraPrompt : undefined,
      background: !config.systemPrompt ? (config.background ?? "") + extraPrompt : config.background,
    })
  } else {
    // 无 lead，自动创建
    const fallbackModel = Object.values(members).map(m => m.getConfig().model).find(Boolean)
    leadAgent = agent({
      role: "团队负责人",
      model: fallbackModel,
      maxTurns: maxRounds ?? 20,
      plugins,
      systemPrompt:
        `你是团队负责人，负责分解任务并委派给合适的成员执行。\n` +
        `团队成员：\n${memberDescriptions}\n\n` +
        `请使用 delegate 工具将子任务分配给合适的成员。\n` +
        `策略：${strategy === "sequential" ? "按顺序逐个委派" : strategy === "parallel" ? "尽量并行委派" : "根据任务特点自动决定"}`,
      tools: [delegateTool],
    })
  }

  return {
    async run(task: string): Promise<TeamRunResult> {
      // 每次运行重置 memberResults 本地闭包状态
      for (const name of Object.keys(memberResults)) memberResults[name] = []
      const startTime = Date.now()

      const result = await leadAgent.run(task)

      // 聚合 lead + 所有 member 的 token 用量
      const allResults = Object.values(memberResults).flat()
      const totalUsage = {
        promptTokens: result.usage.promptTokens + allResults.reduce((s, r) => s + r.usage.promptTokens, 0),
        completionTokens: result.usage.completionTokens + allResults.reduce((s, r) => s + r.usage.completionTokens, 0),
        totalTokens: result.usage.totalTokens + allResults.reduce((s, r) => s + r.usage.totalTokens, 0),
      }

      return {
        output: result.output,
        // 这里需要深拷贝传递，否则多次外部 run() 并发引用的还是同一个引用对象
        memberResults: safeDeepCopy(memberResults),
        usage: totalUsage,
        duration: Date.now() - startTime,
      }
    },

    async *runStream(task: string): AsyncIterable<TeamRunEvent> {
      for (const name of Object.keys(memberResults)) memberResults[name] = []
      
      const queue: TeamRunEvent[] = []
      let isLeadDone = false
      let resumeResolve: Function = () => {}

      streamRef.yieldCb = (event) => {
        queue.push(event)
        resumeResolve?.()
      }

      // 启动 lead 流水
      const leadPromise = (async () => {
        try {
          for await (const event of leadAgent.runStream(task)) {
            queue.push({ ...event, member: "lead" } as TeamRunEvent)
            resumeResolve()
          }
        } finally {
          isLeadDone = true
          resumeResolve()
        }
      })()

      // 并归提取流式事件
      try {
        while (!isLeadDone || queue.length > 0) {
          if (queue.length === 0) {
            await new Promise<void>(r => { resumeResolve = r })
          }
          while (queue.length > 0) {
            yield queue.shift()!
          }
        }
      } finally {
        streamRef.yieldCb = null
      }

      // 确保 lead 的错误被正确传播
      await leadPromise
    },

    getMembers(): Record<string, AgentInstance> {
      return { ...members }
    },
  }
}
