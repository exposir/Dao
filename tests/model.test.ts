/**
 * model 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { registerProvider, resolveModel, detectDefaultModel, getProviderNames, resetProviders } from "../src/core/model.js"

describe("model 层", () => {
  // 保存原始环境变量
  const originalEnv = { ...process.env }

  afterEach(() => {
    // 恢复环境变量
    process.env = { ...originalEnv }
  })

  describe("getProviderNames()", () => {
    it("应该返回所有内置 provider", () => {
      const names = getProviderNames()
      expect(names).toContain("deepseek")
      expect(names).toContain("openai")
      expect(names).toContain("google")
      expect(names).toContain("anthropic")
      expect(names).toContain("moonshotai")
      expect(names).toContain("alibaba")
      expect(names).toContain("zhipu")
    })
  })

  describe("registerProvider()", () => {
    it("应该注册自定义 provider", () => {
      registerProvider("custom", {
        create: async (key) => (id: string) => ({ id }),
        envKey: "CUSTOM_API_KEY",
        defaultModel: "custom-model",
      })
      expect(getProviderNames()).toContain("custom")
    })
  })

  describe("resolveModel()", () => {
    it("未知 provider 应该抛错", async () => {
      await expect(resolveModel("unknown/model")).rejects.toThrow("未知的 provider")
    })

    it("缺少 API Key 应该抛错", async () => {
      delete process.env.DEEPSEEK_API_KEY
      await expect(resolveModel("deepseek/deepseek-chat")).rejects.toThrow("缺少环境变量")
    })
  })

  describe("detectDefaultModel()", () => {
    it("没有任何 API Key 时应该返回 undefined", () => {
      // 清除所有相关环境变量
      delete process.env.DEEPSEEK_API_KEY
      delete process.env.OPENAI_API_KEY
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
      delete process.env.ANTHROPIC_API_KEY
      delete process.env.MOONSHOTAI_API_KEY
      delete process.env.ALIBABA_API_KEY
      delete process.env.ZHIPU_API_KEY

      expect(detectDefaultModel()).toBeUndefined()
    })

    it("有 DEEPSEEK_API_KEY 时应该返回 deepseek 模型", () => {
      process.env.DEEPSEEK_API_KEY = "test-key"
      const model = detectDefaultModel()
      expect(model).toBe("deepseek/deepseek-chat")
    })
  })

  describe("resetProviders()", () => {
    afterEach(() => {
      resetProviders()
    })

    it("应该移除自定义注册的 provider", () => {
      registerProvider("test-custom", {
        create: async (key) => (id: string) => ({ id }),
        envKey: "TEST_CUSTOM_KEY",
        defaultModel: "test-model",
      })
      expect(getProviderNames()).toContain("test-custom")

      resetProviders()
      expect(getProviderNames()).not.toContain("test-custom")
    })

    it("重置后内置 provider 应该保留", () => {
      registerProvider("temp", {
        create: async (key) => (id: string) => ({ id }),
        envKey: "TEMP_KEY",
        defaultModel: "temp-model",
      })
      resetProviders()

      const names = getProviderNames()
      expect(names).toContain("deepseek")
      expect(names).toContain("openai")
      expect(names).toContain("google")
    })

    it("覆盖内置 provider 后 resetProviders() 应恢复原实现", async () => {
      // 覆盖内置的 openai provider
      registerProvider("openai", {
        create: async () => (_id: string) => ({ fake: true }),
        envKey: "FAKE_OPENAI_KEY",
        defaultModel: "fake-model",
      })

      // 此时 resolveModel("openai/xxx") 会读 FAKE_OPENAI_KEY
      resetProviders()

      // 恢复后应该回到初始的 OPENAI_API_KEY
      // 通过 resolveModel 验证：无 OPENAI_API_KEY 时应报环境变量缺失
      await expect(
        resolveModel("openai/gpt-4o")
      ).rejects.toThrow("OPENAI_API_KEY")
    })
  })
})
