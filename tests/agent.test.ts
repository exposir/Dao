/**
 * agent() 单元测试
 */

import { describe, it, expect, vi } from "vitest"
import { agent } from "../src/agent.js"
import type { AgentOptions } from "../src/core/types.js"

describe("agent()", () => {
  it("应该返回 AgentInstance 对象", () => {
    const bot = agent({ model: "deepseek/deepseek-chat" })
    expect(bot).toHaveProperty("chat")
    expect(bot).toHaveProperty("run")
    expect(bot).toHaveProperty("chatStream")
    expect(bot).toHaveProperty("runStream")
    expect(bot).toHaveProperty("clearMemory")
    expect(bot).toHaveProperty("getConfig")
  })

  it("传 steps 不应该抛错（V0.5 已支持）", () => {
    expect(() =>
      agent({
        model: "deepseek/deepseek-chat",
        steps: ["步骤一", "步骤二"],
      })
    ).not.toThrow()
  })

  it("空 steps 数组不应该抛错", () => {
    expect(() =>
      agent({
        model: "deepseek/deepseek-chat",
        steps: [],
      })
    ).not.toThrow()
  })

  it("getConfig() 应该返回配置副本", () => {
    const options: AgentOptions = {
      model: "deepseek/deepseek-chat",
      role: "助手",
      memory: true,
    }
    const bot = agent(options)
    const config = bot.getConfig()

    expect(config.model).toBe("deepseek/deepseek-chat")
    expect(config.role).toBe("助手")
    expect(config.memory).toBe(true)
    // 应该是副本，修改不影响原对象
    config.role = "已修改"
    expect(bot.getConfig().role).toBe("助手")
  })

  it("clearMemory() 应该清除记忆", () => {
    const bot = agent({ model: "deepseek/deepseek-chat", memory: true })
    // clearMemory 不应该抛错
    expect(() => bot.clearMemory()).not.toThrow()
  })

  it("getConfig() 返回的 steps 对象不应反向污染原配置", () => {
    const taskStep = { task: "原始任务", output: "JSON" }
    const bot = agent({
      model: "deepseek/deepseek-chat",
      steps: [taskStep, "字符串步骤"],
    })

    const config = bot.getConfig()
    // steps 是浅拷贝数组，元素仍是共享引用
    // 但顶层数组的 push/splice 不应影响内部
    config.steps!.push("新步骤")
    expect(bot.getConfig().steps).toHaveLength(2) // 原始 2 个
  })

  it("getConfig() 返回的 rules.focus 不应反向污染原配置", () => {
    const bot = agent({
      model: "deepseek/deepseek-chat",
      rules: { focus: ["代码质量"], reject: ["删除文件"] },
    })

    const config = bot.getConfig()
    config.rules!.focus!.push("新规则")
    config.rules!.reject!.push("新禁止")

    // 原 agent 的 rules 不应被污染
    const fresh = bot.getConfig()
    expect(fresh.rules!.focus).toEqual(["代码质量"])
    expect(fresh.rules!.reject).toEqual(["删除文件"])
  })

  it("getConfig() 返回的 delegates 不应反向污染原配置", () => {
    const helper = agent({ model: "deepseek/deepseek-chat", role: "helper" })
    const bot = agent({
      model: "deepseek/deepseek-chat",
      delegates: { helper },
    })

    const config = bot.getConfig()
    // 删除返回值中的 delegate 不应影响内部
    delete (config.delegates as any).helper
    expect(bot.getConfig().delegates).toHaveProperty("helper")
  })
})
