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

const messages: Record<string, Record<Locale, string>> = {
  // 错误信息
  "error.noModel": {
    zh: "未指定模型。请通过 agent({ model: \"provider/model\" }) 或 configure({ defaultModel: \"provider/model\" }) 指定，或设置环境变量（如 DEEPSEEK_API_KEY）让框架自动检测。",
    en: "No model specified. Use agent({ model: \"provider/model\" }), configure({ defaultModel: \"provider/model\" }), or set environment variables (e.g. DEEPSEEK_API_KEY) for auto-detection.",
  },
  "error.noModelShort": {
    zh: "未指定模型。",
    en: "No model specified.",
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
  "error.maxTurns": {
    zh: "configure(): defaultMaxTurns 必须大于 0",
    en: "configure(): defaultMaxTurns must be greater than 0",
  },
  "error.abort": {
    zh: "步骤执行被中止",
    en: "Step execution aborted",
  },
  "error.mcpNeedDep": {
    zh: "使用 mcpTools() 需要安装 @ai-sdk/mcp：npm install @ai-sdk/mcp",
    en: "mcpTools() requires @ai-sdk/mcp: npm install @ai-sdk/mcp",
  },
  "error.mcpClientNeedDep": {
    zh: "使用 mcpClient() 需要安装 @ai-sdk/mcp：npm install @ai-sdk/mcp",
    en: "mcpClient() requires @ai-sdk/mcp: npm install @ai-sdk/mcp",
  },
  "error.mcpNeedTransport": {
    zh: "mcpTools() 需要指定 url（SSE 模式）或 command（Stdio 模式）",
    en: "mcpTools() requires url (SSE mode) or command (Stdio mode)",
  },
  "error.mcpClientNeedTransport": {
    zh: "mcpClient() 需要指定 url 或 command",
    en: "mcpClient() requires url or command",
  },
  "error.toolConfirm": {
    zh: "工具 \"{name}\" 要求确认执行，但未配置 onConfirm 回调",
    en: "Tool \"{name}\" requires confirmation, but no onConfirm callback configured",
  },
  "error.waitNeedResume": {
    zh: "wait 步骤需要 resume() 支持，请通过 agent 实例调用",
    en: "wait step requires resume() support, call via agent instance",
  },
  "error.unknownStep": {
    zh: "未知的步骤类型: {step}",
    en: "Unknown step type: {step}",
  },
  "error.mockExhausted": {
    zh: "mockModel: 预设响应已用完（共 {count} 条）",
    en: "mockModel: preset responses exhausted ({count} total)",
  },
  "error.providerNotFound": {
    zh: "未找到 provider \"{provider}\"。请安装对应的 @ai-sdk 包并调用 registerProvider() 注册，或在 agent() 中通过 modelProvider 传入已创建的模型实例。",
    en: "Provider \"{provider}\" not found. Install the corresponding @ai-sdk package and call registerProvider(), or pass a model instance via modelProvider in agent().",
  },
  "error.unknownProvider": {
    zh: "未知的 provider: \"{provider}\"。可用的 provider: {available}。如需自定义 provider，请使用 registerProvider()。",
    en: "Unknown provider: \"{provider}\". Available providers: {available}. Use registerProvider() for custom providers.",
  },
  "error.missingEnvKey": {
    zh: "缺少环境变量 {envKey}。请在 .env 文件或环境变量中设置该值。",
    en: "Missing environment variable {envKey}. Set it in your .env file or environment.",
  },
  "error.providerCreateFailed": {
    zh: "无法从 provider \"{provider}\" 创建模型 \"{model}\"。",
    en: "Failed to create model \"{model}\" from provider \"{provider}\".",
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
    zh: "📥 输入",
    en: "📥 Input",
  },
  "logger.modelCall": {
    zh: "🤖 调用模型...",
    en: "🤖 Calling model...",
  },
  "logger.modelReturn": {
    zh: "✅ 模型返回",
    en: "✅ Model returned",
  },
  "logger.toolCall": {
    zh: "🔧 调用工具",
    en: "🔧 Tool call",
  },
  "logger.toolResult": {
    zh: "✅ 工具结果",
    en: "✅ Tool result",
  },
  "logger.complete": {
    zh: "🏁 完成",
    en: "🏁 Complete",
  },
  "logger.tokens": {
    zh: "📊 tokens",
    en: "📊 tokens",
  },
  "logger.error": {
    zh: "❌ 错误",
    en: "❌ Error",
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
