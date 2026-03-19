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
})
