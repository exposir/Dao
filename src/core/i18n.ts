/**
 * 道（Dao）— 国际化支持
 *
 * 提供中英文切换，所有内置字符串通过 t(key) 获取。
 */

/** 支持的语言 */
export type Locale = "zh" | "en"

/** 当前语言，默认中文 */
let currentLocale: Locale = "zh"

/** 设置当前语言 */
export function setLocale(locale: Locale): void {
  currentLocale = locale
}

/** 获取当前语言 */
export function getLocale(): Locale {
  return currentLocale
}

/** 翻译字符串映射表 */
const messages: Record<string, Record<Locale, string>> = {
  // 错误信息
  "error.noModel": {
    zh: "未指定模型。请通过 agent({ model: \"provider/model\" }) 或 configure({ defaultModel: \"provider/model\" }) 指定，或设置环境变量（如 DEEPSEEK_API_KEY）让框架自动检测。",
    en: "No model specified. Use agent({ model: \"provider/model\" }), configure({ defaultModel: \"provider/model\" }), or set environment variables (e.g. DEEPSEEK_API_KEY) for auto-detection.",
  },
  "error.costLimit": {
    zh: "Token 用量 ({totalTokens}) 超过上限 ({limit})",
    en: "Token usage ({totalTokens}) exceeds limit ({limit})",
  },
  "error.timeout": {
    zh: "模型调用超时（{ms}ms）",
    en: "Model call timed out ({ms}ms)",
  },
  "error.modelFail": {
    zh: "模型调用失败：{message}",
    en: "Model call failed: {message}",
  },
  "error.toolFail": {
    zh: "工具 {name} 执行失败：{message}",
    en: "Tool {name} execution failed: {message}",
  },
  "error.emptyModel": {
    zh: "defaultModel 不能为空字符串",
    en: "defaultModel cannot be an empty string",
  },
  "error.abort": {
    zh: "步骤执行被中止",
    en: "Step execution aborted",
  },
  "error.mcpNeedDep": {
    zh: "使用 mcpTools() 需要安装 @ai-sdk/mcp：npm install @ai-sdk/mcp",
    en: "mcpTools() requires @ai-sdk/mcp: npm install @ai-sdk/mcp",
  },
  "error.mcpNeedTransport": {
    zh: "mcpTools() 需要指定 url（SSE 模式）或 command（Stdio 模式）",
    en: "mcpTools() requires url (SSE mode) or command (Stdio mode)",
  },

  // System Prompt
  "prompt.role": {
    zh: "你是{role}",
    en: "You are {role}",
  },
  "prompt.goal": {
    zh: "你的目标是：{goal}",
    en: "Your goal is: {goal}",
  },
  "prompt.background": {
    zh: "背景：{background}",
    en: "Background: {background}",
  },

  // Logger
  "logger.input": {
    zh: "[输入]",
    en: "[Input]",
  },
  "logger.output": {
    zh: "[输出]",
    en: "[Output]",
  },
  "logger.error": {
    zh: "[错误]",
    en: "[Error]",
  },
  "logger.toolSkipped": {
    zh: "[工具调用被插件跳过]",
    en: "[Tool call skipped by plugin]",
  },

  // Delegate
  "delegate.desc": {
    zh: "将任务委派给{name}",
    en: "Delegate task to {name}",
  },
}

/**
 * 获取翻译文本
 * @param key 翻译键
 * @param params 替换参数，如 { name: "xxx" } 会替换 {name}
 */
export function t(key: string, params?: Record<string, any>): string {
  const entry = messages[key]
  if (!entry) return key
  let text = entry[currentLocale] ?? entry.zh ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v))
    }
  }
  return text
}
