/**
 * Dao 助手 — Agent 定义
 *
 * 这里定义你的 AI 助手。
 * Dao 的设计哲学：渐进式复杂度，从小开始，逐步扩展。
 *
 * 演进路径：
 *   chat()          → 3 行跑通，聊天
 *   + tools         → 赋予工具能力
 *   + memory        → 多轮对话，记住上下文
 *   + rules         → 加约束，引导行为
 *   + steps         → 多步骤流水线
 *
 * 修改这个文件来自定义你的助手行为。
 */

import "dotenv/config"
import { agent } from "dao-ai"
// === TOOL_IMPORTS ===
import { readFile, listDir, runCommand } from "dao-ai/tools"
import { webSearch, calculator } from "./tools.js"
// === END TOOL_IMPORTS ===

// ============================================================
// 助手配置
// ============================================================

const MY_ASSISTANT = agent({
  // 身份：助手是谁？
  role: "{{assistantRole}}",

  // 目标：助手要做什么？
  goal: "{{assistantGoal}}",

  // 背景：助手有什么经验？（注入到 system prompt）
  background: [
    "你是一个乐于助人的 AI 助手，擅长编程、分析、写作和问题解决",
    "你会主动思考最佳方案，不会盲目执行用户的每一个指令",
    "你诚实守信，不知道就说不知道，不会编造信息",
  ].join("。"),

  // 模型选择
  model: "{{modelString}}",

  // 工具列表：助手可以使用哪些工具？
  // 添加工具只需在这里加一行，框架自动处理调用逻辑
  tools: [
    readFile,        // 读取文件
    listDir,         // 浏览目录
    runCommand,      // 执行命令（慎用）
    webSearch,       // 网络搜索（见 tools.ts）
    calculator,      // 计算器（见 tools.ts）
  ],

  // 记忆：多轮对话时是否记住上下文？
  // true 开启，false 关闭（默认关闭以节省 token）
  memory: true,

  // 行为规则：引导助手的行为方向
  // rules.reject 会注入到 system prompt，不做硬拦截
  rules: {
    focus: [
      "回答准确、有深度",
      "代码简洁、可读",
      "主动发现潜在问题",
    ],
    reject: [
      "不要编造事实或引用不存在的来源",
      "不要执行破坏性命令（如 rm -rf，除非明确告知用户风险）",
      "不要输出过长内容，先问用户是否需要更详细的解释",
    ],
  },

  // 最大对话轮次：防止无限循环
  maxTurns: 50,
})

// ============================================================
// 导出给 index.ts 使用
// ============================================================

export { MY_ASSISTANT }
