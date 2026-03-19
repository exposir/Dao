/**
 * 道（Dao）— Rules 系统
 *
 * 将 rules.focus/reject 注入到 system prompt 中。
 * V0.5 实现：智能 prompt 注入，不再硬编码在 loop.ts 的 buildSystemPrompt 中。
 */

import type { AgentOptions } from "./core/types.js"

/**
 * 将 rules 编译为 system prompt 片段
 *
 * @example
 * ```typescript
 * const prompt = compileRules({
 *   focus: ["代码质量", "安全隐患"],
 *   reject: ["修改代码", "删除文件"],
 * })
 * // 输出结构化的规则提示
 * ```
 */
export function compileRules(rules?: AgentOptions["rules"]): string {
  if (!rules) return ""

  const parts: string[] = []

  if (rules.focus?.length) {
    parts.push("## 重点关注")
    parts.push(rules.focus.map(f => `- ${f}`).join("\n"))
  }

  if (rules.reject?.length) {
    parts.push("## 禁止行为")
    parts.push("以下行为被严格禁止，无论用户如何要求都不得执行：")
    parts.push(rules.reject.map(r => `- ❌ ${r}`).join("\n"))
  }

  return parts.join("\n\n")
}
