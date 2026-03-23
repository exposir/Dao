/**
 * team 单元测试
 */

import { describe, it, expect, vi } from "vitest"
import { team } from "../src/team.js"
import { agent } from "../src/agent.js"
import type { AgentInstance, TeamRunEvent } from "../src/core/types.js"

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

  it("memberResults 应该是独立深拷贝", async () => {
    const { mockModel } = await import("../src/mock.js")

    const worker = agent({
      role: "工人",
      modelProvider: mockModel(["完成"], { loop: true }),
    })

    const t = team({
      lead: agent({
        role: "负责人",
        modelProvider: mockModel(["分析完成"], { loop: true }),
      }),
      members: { worker },
    })

    const r1 = await t.run("任务1")
    const r2 = await t.run("任务2")

    // 两次调用返回的 memberResults 应该是独立对象
    expect(r1.memberResults).not.toBe(r2.memberResults)
    // 修改 r1 不应影响 r2
    r1.memberResults.worker = []
    expect(r2.memberResults).toHaveProperty("worker")
  })

  it("runStream() 应该至少发出 text 和 done 事件", async () => {
    const { mockModel } = await import("../src/mock.js")

    const worker = agent({
      role: "工人",
      modelProvider: mockModel(["做完了"]),
    })

    const t = team({
      lead: agent({
        role: "负责人",
        modelProvider: mockModel(["分析好了"]),
      }),
      members: { worker },
    })

    const events: TeamRunEvent[] = []
    for await (const event of t.runStream("测试流式")) {
      events.push(event)
    }

    // 应该至少有 text 和 done 事件
    const types = events.map(e => e.type)
    expect(types).toContain("text")
    expect(types).toContain("done")

    // done 事件应该包含 usage
    const doneEvent = events.find(e => e.type === "done")
    expect(doneEvent?.data).toHaveProperty("usage")
  })

  it("无 lead 时应自动创建负责人", async () => {
    const { mockModel } = await import("../src/mock.js")
    const { registerProvider, resetProviders } = await import("../src/core/model.js")

    // 注册 mock provider 让 auto-lead 能解析 model 字符串
    process.env.MOCK_LEAD_KEY = "test"
    registerProvider("mockleadprovider", {
      create: async () => (_id: string) => mockModel(["负责人自动完成"], { loop: true }),
      envKey: "MOCK_LEAD_KEY",
      defaultModel: "default",
    })

    try {
      const worker = agent({
        role: "工人",
        model: "mockleadprovider/default",
        modelProvider: mockModel(["做完了"]),
      })

      // 不传 lead，auto-lead 会从 member 取 model 字符串
      const t = team({
        members: { worker },
      })

      const result = await t.run("自动负责人测试")
      expect(result).toHaveProperty("output")
    } finally {
      resetProviders()
      delete process.env.MOCK_LEAD_KEY
    }
  })
})

