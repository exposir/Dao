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
 *   strategy: "auto",
 * })
 * const result = await squad.run("添加用户登录功能")
 * ```
 */
export function team(options: TeamOptions): TeamInstance {
  const { members, lead, strategy = "auto" } = options

  // 构建 member 描述，供 lead Agent 了解团队能力
  const memberDescriptions = Object.entries(members)
    .map(([name, member]) => {
      const config = member.getConfig()
      return `- **${name}**: ${config.role ?? "通用 Agent"}`
    })
    .join("\n")

  // 用闭包收集 member 执行结果
  const memberResults: Record<string, RunResult[]> = {}
  for (const name of Object.keys(members)) {
    memberResults[name] = []
  }

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
        const result = await memberAgent.run(task)
        memberResults[memberName].push(result)
        return result.output
      } catch (err: any) {
        return `成员 "${memberName}" 执行失败：${err.message}`
      }
    },
  })

  // 创建 lead Agent
  const leadConfig = lead?.getConfig?.() ?? {}
  const leadAgent = lead ?? agent({
    role: "团队负责人",
    model: leadConfig.model ?? Object.values(members)[0]?.getConfig().model,
    systemPrompt:
      `你是团队负责人，负责分解任务并委派给合适的成员执行。\n` +
      `团队成员：\n${memberDescriptions}\n\n` +
      `请使用 delegate 工具将子任务分配给合适的成员。\n` +
      `策略：${strategy === "sequential" ? "按顺序逐个委派" : strategy === "parallel" ? "尽量并行委派" : "根据任务特点自动决定"}`,
    tools: [...(leadConfig.tools ?? []), delegateTool],
  })

  // 如果用户提供了 lead，为其注入 delegate 工具
  if (lead) {
    const config = lead.getConfig()
    // 重新创建 lead，注入 delegate 工具
    const enhancedLead = agent({
      ...config,
      tools: [...(config.tools ?? []), delegateTool],
      systemPrompt:
        (config.systemPrompt ?? "") +
        `\n\n你可以使用 delegate 工具委派任务给团队成员。\n团队成员：\n${memberDescriptions}`,
    })
    return createTeamInstance(enhancedLead, members, memberResults, options)
  }

  return createTeamInstance(leadAgent, members, memberResults, options)
}

/** 创建 TeamInstance */
function createTeamInstance(
  leadAgent: AgentInstance,
  members: Record<string, AgentInstance>,
  memberResults: Record<string, any[]>,
  options: TeamOptions,
): TeamInstance {
  return {
    async run(task: string): Promise<TeamRunResult> {
      const startTime = Date.now()

      const result = await leadAgent.run(task)

      return {
        output: result.output,
        memberResults,
        usage: result.usage,
        duration: Date.now() - startTime,
      }
    },

    async *runStream(task: string): AsyncIterable<TeamRunEvent> {
      for await (const event of leadAgent.runStream(task)) {
        yield {
          ...event,
          member: "lead",
        } as TeamRunEvent
      }
    },

    getMembers(): Record<string, AgentInstance> {
      return { ...members }
    },
  }
}
