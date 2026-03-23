/**
 * 道（Dao）— OpenTelemetry 集成
 *
 * 可选的 trace/span 支持，通过插件系统挂载。
 * 需要安装可选依赖：npm install @opentelemetry/api
 */

import type { PluginInstance } from "./core/types.js"

/** 遥测插件配置 */
export interface TelemetryOptions {
  /** 服务名称 */
  serviceName?: string
  /** 是否记录输入/输出内容 */
  recordContent?: boolean
}

/**
 * 创建 OpenTelemetry 遥测插件
 *
 * @example
 * ```typescript
 * import { configure, telemetryPlugin } from "dao-ai"
 *
 * configure({
 *   globalPlugins: [telemetryPlugin({ serviceName: "my-app" })],
 * })
 * ```
 */
export function telemetryPlugin(options: TelemetryOptions = {}): PluginInstance {
  const serviceName = options.serviceName ?? "dao-agent"
  const recordContent = options.recordContent ?? false

  let tracer: any = null

  return {
    __type: "plugin",
    name: "telemetry",

    async setup() {
      // 动态导入 @opentelemetry/api
      try {
        const otel = await import("@opentelemetry/api")
        tracer = otel.trace.getTracer(serviceName)
      } catch {
        // OpenTelemetry 未安装，静默降级
        console.warn("[dao-telemetry] @opentelemetry/api not installed, telemetry disabled")
      }
    },

    hooks: {
      beforeInput: async (ctx) => {
        if (!tracer) return
        const span = tracer.startSpan("dao.input")
        if (recordContent && ctx.message) {
          span.setAttribute("dao.input", typeof ctx.message === "string" ? ctx.message : "[multimodal]")
        }
        span.end()
      },

      beforeModelCall: async (ctx) => {
        if (!tracer) return
        const span = tracer.startSpan("dao.model_call")
        if (ctx.prompt) {
          span.setAttribute("dao.system_prompt_length", ctx.prompt.length)
        }
        span.end()
      },

      afterModelCall: async (ctx) => {
        if (!tracer) return
        const span = tracer.startSpan("dao.model_response")
        if (ctx.response?.usage) {
          span.setAttribute("dao.tokens.prompt", ctx.response.usage.promptTokens)
          span.setAttribute("dao.tokens.completion", ctx.response.usage.completionTokens)
          span.setAttribute("dao.tokens.total", ctx.response.usage.totalTokens)
        }
        span.end()
      },

      onComplete: async (ctx) => {
        if (!tracer) return
        const span = tracer.startSpan("dao.complete")
        if (ctx.result) {
          span.setAttribute("dao.duration", ctx.result.duration ?? 0)
          if (recordContent) {
            span.setAttribute("dao.output", ctx.result.output ?? "")
          }
        }
        span.end()
      },

      onError: async (ctx) => {
        if (!tracer) return
        const span = tracer.startSpan("dao.error")
        span.setAttribute("dao.error", ctx.error?.message ?? "unknown")
        span.setStatus({ code: 2 }) // SpanStatusCode.ERROR
        span.end()
      },
    },
  }
}
