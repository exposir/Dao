/**
 * 自定义工具
 *
 * Dao 内置了一些常用工具（见 dao-ai/tools）。
 * 在这里添加你项目特有的工具。
 *
 * 工具结构：
 *   name        — 工具名称，AI 通过它决定何时调用
 *   description — 描述工具用途，AI 根据这个理解如何使用
 *   params      — 输入参数定义（简写语法，框架自动转 JSON Schema）
 *   run         — 实际执行逻辑
 */

import { tool } from "dao-ai"

// ============================================================
// 工具：网络搜索
// ============================================================

export const webSearch = tool({
  name: "webSearch",
  description: "搜索互联网，返回与关键词相关的摘要信息",
  params: {
    query: "搜索关键词",
    limit: { type: "number", description: "返回结果数量，默认 5", optional: true },
  },
  async run({ query, limit = 5 }) {
    // 这里接入任意搜索 API（Google SerpAPI、DuckDuckGo 等）
    // 示例使用 DuckDuckGo Instant Answer API（无需 key）
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`

    const res = await fetch(url)
    if (!res.ok) return `搜索失败：${res.status}`

    const data = await res.json() as {
      AbstractText?: string
      RelatedTopics?: Array<{ Text?: string }>
    }

    const snippets: string[] = []
    if (data.AbstractText) snippets.push(data.AbstractText)
    if (data.RelatedTopics) {
      snippets.push(...data.RelatedTopics
        .filter(t => t.Text)
        .slice(0, (limit as number) - snippets.length)
        .map(t => t.Text!)
      )
    }

    if (snippets.length === 0) return `未找到 "${query}" 相关结果`

    return snippets.slice(0, limit).map((s, i) => `${i + 1}. ${s}`).join("\n")
  },
})

// ============================================================
// 工具：计算器（安全表达式计算）
// ============================================================

export const calculator = tool({
  name: "calculator",
  description: "计算数学表达式的值，支持 + - * / ( ) 和常见数学函数",
  params: {
    expression: "数学表达式，如 2+3*4 或 Math.sqrt(16)",
  },
  run({ expression }) {
    // 安全检查：只允许数字和常见数学符号
    if (!/^[\d\s+\-*/().,Math\w]+$/.test(expression)) {
      return "错误：表达式包含非法字符"
    }
    try {
      // eslint-disable-next-line no-new-func
      const result = new Function(`"use strict"; return (${expression})`)()
      return String(result)
    } catch {
      return "错误：无法计算此表达式"
    }
  },
})

// ============================================================
// 工具模板：如何添加新工具
// ============================================================

/**
 * // 在 tools.ts 添加：
 * const myTool = tool({
 *   name: "myTool",
 *   description: "工具用途描述",
 *   params: {
 *     input: "输入参数描述",
 *     // optional 参数：
 *     option: { type: "string", description: "可选参数", optional: true },
 *   },
 *   async run({ input, option }) {
 *     // 实现逻辑，返回字符串结果
 *     return `结果：${input}`
 *   },
 * })
 *
 * // 在 agent.ts 的 tools 数组中注册：
 * import { myTool } from "./tools.js"
 * tools: [readFile, myTool, ...]
 */
