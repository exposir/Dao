/**
 * 道（Dao）— 插件系统
 *
 * plugin() 创建插件实例，提供 hooks 生命周期。
 * 插件通过 agent({ plugins: [...] }) 注入。
 */

import type {
  PluginOptions,
  PluginInstance,
  PluginHooks,
  HookContext,
  AgentInstance,
} from "./core/types.js"
import { t } from "./core/i18n.js"

/**
 * 创建一个插件实例
 *
 * @example
 * ```typescript
 * const myLogger = plugin({
 *   name: "logger",
 *   hooks: {
 *     beforeModelCall: (ctx) => console.log("调用模型..."),
 *     afterModelCall: (ctx) => console.log("模型返回:", ctx.response),
 *     onError: (ctx) => console.error("错误:", ctx.error),
 *   },
 * })
 *
 * const bot = agent({ plugins: [myLogger] })
 * ```
 */
export function plugin(options: PluginOptions): PluginInstance {
  return {
    __type: "plugin",
    name: options.name,
    setup: options.setup,
    hooks: options.hooks ?? {},
  }
}

/**
 * 插件管理器（内部使用）
 *
 * 负责初始化插件、调度 hooks。
 */
export class PluginManager {
  private plugins: PluginInstance[] = []
  private stores: Map<string, Record<string, any>> = new Map()

  constructor(plugins: PluginInstance[] = []) {
    this.plugins = plugins
    // 为每个插件创建独立的 store（按 name 索引，同名插件共享 store）
    for (const p of plugins) {
      if (!this.stores.has(p.name)) {
        this.stores.set(p.name, {})
      }
    }
  }

  /** 初始化所有插件 */
  async setup(agent: AgentInstance): Promise<void> {
    for (const p of this.plugins) {
      if (p.setup) {
        await p.setup(agent)
      }
    }
  }

  /** 触发 hook */
  async emit<K extends keyof PluginHooks>(
    hookName: K,
    agent: AgentInstance,
    extra: Record<string, any> = {},
  ): Promise<{ skipped: boolean }> {
    let skipped = false

    for (const p of this.plugins) {
      const hook = p.hooks[hookName]
      if (!hook) continue

      const ctx: HookContext = {
        agent,
        timestamp: Date.now(),
        store: this.stores.get(p.name) ?? {},
        skip: () => { skipped = true },
        ...extra,
      }

      try {
        await (hook as (ctx: HookContext) => void | Promise<void>)(ctx)
      } catch (err) {
        // onError hook 自身报错不应吞掉，否则错误处理链断裂
        if (hookName === "onError") throw err
        // 其他 hook 报错不应炸穿核心路径，打印警告并继续
        console.warn(
          `[Dao] 插件 "${p.name}" 的 ${String(hookName)} hook 执行出错:`,
          err instanceof Error ? err.message : err,
        )
      }
      if (skipped) break
    }

    return { skipped }
  }

  /** 是否有插件 */
  get hasPlugins(): boolean {
    return this.plugins.length > 0
  }
}

/**
 * 内置 logger 插件
 *
 * @example
 * ```typescript
 * import { agent, logger } from "dao-ai"
 * const bot = agent({ plugins: [logger()] })
 * ```
 */
export function logger(options?: {
  /** 是否输出 token 用量 */
  showUsage?: boolean
  /** 自定义前缀 */
  prefix?: string
}): PluginInstance {
  const prefix = options?.prefix ?? "[Dao]"
  const showUsage = options?.showUsage ?? true

  return plugin({
    name: "logger",
    hooks: {
      beforeInput: (ctx) => {
        console.log(`${prefix} ${t("logger.input")}: ${ctx.message}`)
      },
      beforeModelCall: () => {
        console.log(`${prefix} ${t("logger.modelCall")}`)
      },
      afterModelCall: (ctx) => {
        const resp = ctx.response
        const text = typeof resp === "string" ? resp : JSON.stringify(resp)?.slice(0, 100)
        console.log(`${prefix} ${t("logger.modelReturn")}: ${text}...`)
      },
      beforeToolCall: (ctx) => {
        console.log(`${prefix} ${t("logger.toolCall")}: ${ctx.tool}`)
      },
      afterToolCall: (ctx) => {
        console.log(`${prefix} ${t("logger.toolResult")}: ${JSON.stringify(ctx.result)?.slice(0, 100)}`)
      },
      onComplete: (ctx) => {
        const result = ctx.result
        console.log(`${prefix} ${t("logger.complete")} (${result.duration}ms)`)
        if (showUsage && result.usage) {
          console.log(`${prefix} ${t("logger.tokens")}: ${result.usage.totalTokens}`)
        }
      },
      onError: (ctx) => {
        console.error(`${prefix} ${t("logger.error")}: ${ctx.error.message}`)
      },
    },
  })
}
