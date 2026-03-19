/**
 * rules 单元测试
 */

import { describe, it, expect } from "vitest"
import { compileRules } from "../src/rules.js"

describe("compileRules()", () => {
  it("空 rules 应该返回空字符串", () => {
    expect(compileRules()).toBe("")
    expect(compileRules({})).toBe("")
  })

  it("只有 focus 时应该正确编译", () => {
    const result = compileRules({ focus: ["代码质量", "安全隐患"] })
    expect(result).toContain("重点关注")
    expect(result).toContain("代码质量")
    expect(result).toContain("安全隐患")
  })

  it("只有 reject 时应该正确编译", () => {
    const result = compileRules({ reject: ["修改代码", "删除文件"] })
    expect(result).toContain("禁止行为")
    expect(result).toContain("❌ 修改代码")
    expect(result).toContain("❌ 删除文件")
  })

  it("focus + reject 同时存在时都应该包含", () => {
    const result = compileRules({
      focus: ["性能优化"],
      reject: ["修改接口"],
    })
    expect(result).toContain("重点关注")
    expect(result).toContain("性能优化")
    expect(result).toContain("禁止行为")
    expect(result).toContain("❌ 修改接口")
  })

  it("空数组应该等同于 undefined", () => {
    expect(compileRules({ focus: [], reject: [] })).toBe("")
  })
})
