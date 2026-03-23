/**
 * team 单元测试
 */

import { describe, it, expect, vi } from "vitest"
import { team } from "../src/team.js"
import { agent } from "../src/agent.js"
import type { AgentInstance } from "../src/core/types.js"

// mock agent
function mockMember(role: string): AgentInstance {
  return {
    chat: vi.fn(async () => `${role} 回复`),
    run: vi.fn(async () => ({ output: `${role} 完成`, turns: [], usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, duration: 0 })),
    chatStream: vi.fn(async function* () { yield "mock" }),
    runStream: vi.fn(async function* () {}),
    resume: vi.fn(),
    generate: vi.fn(),
    clearMemory: vi.fn(),
    getConfig: vi.fn(() => ({ role, model: "deepseek/deepseek-chat" })),
  }
}

describe("team()", () => {
  it("应该创建 TeamInstance", () => {
    const coder = mockMember("开发者")
    const tester = mockMember("测试")

    const t = team({
      members: { coder, tester },
    })

    expect(t).toHaveProperty("run")
    expect(t).toHaveProperty("runStream")
    expect(t).toHaveProperty("getMembers")
  })

  it("getMembers 应该返回成员列表", () => {
    const coder = mockMember("开发者")
    const tester = mockMember("测试")

    const t = team({
      members: { coder, tester },
    })

    const members = t.getMembers()
    expect(Object.keys(members)).toEqual(["coder", "tester"])
  })

  it("应该支持 strategy 参数", () => {
    const coder = mockMember("开发者")

    // 不应该抛错
    expect(() =>
      team({ members: { coder }, strategy: "sequential" })
    ).not.toThrow()

    expect(() =>
      team({ members: { coder }, strategy: "parallel" })
    ).not.toThrow()

    expect(() =>
      team({ members: { coder }, strategy: "auto" })
    ).not.toThrow()
  })

  it("getMembers() 返回的应该是副本", () => {
    const coder = mockMember("开发者")
    const t = team({ members: { coder } })

    const members = t.getMembers()
    // 修改返回值不应影响内部
    delete (members as any).coder
    expect(Object.keys(t.getMembers())).toEqual(["coder"])
  })
})

describe("team.run() 行为", () => {
  it("run() 应返回 output 和 usage", async () => {
    // 用 mockModel 创建真实可运行的 members
    const { mockModel } = await import("../src/mock.js")

    const coder = agent({
      role: "开发者",
      modelProvider: mockModel(["代码写好了"]),
    })

    // lead 需要足够多的响应来完成调度
    const t = team({
      lead: agent({
        role: "负责人",
        modelProvider: mockModel(["任务分析完成"]),
      }),
      members: { coder },
    })

    const result = await t.run("写代码")
    expect(result).toHaveProperty("output")
    expect(result).toHaveProperty("usage")
    expect(result).toHaveProperty("duration")
    expect(result).toHaveProperty("memberResults")
    expect(typeof result.output).toBe("string")
    expect(result.duration).toBeGreaterThanOrEqual(0)
  })
})
