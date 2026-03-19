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
})
