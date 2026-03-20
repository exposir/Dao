/**
 * 道（Dao）— 工具系统
 *
 * tool() 函数 + 参数简写转 JSON Schema
 */

import type {
  ToolOptions,
  ToolInstance,
  ToolContext,
  ParamsDef,
  ParamSpec,
  JSONSchema,
} from "./core/types.js"

/**
 * 创建一个工具实例
 *
 * @example
 * ```typescript
 * const readFile = tool({
 *   name: "readFile",
 *   description: "读取文件",
 *   params: { path: "文件路径" },
 *   run: ({ path }) => fs.readFileSync(path, "utf-8"),
 * })
 * ```
 */
export function tool(options: ToolOptions): ToolInstance {
  const { name, description, params, run, confirm = false } = options

  return {
    __type: "tool",
    name,
    description,
    schema: paramsToJsonSchema(params ?? {}),
    execute: async (p: any, ctx?: ToolContext) => {
      return await run(p, ctx)
    },
    confirm,
  }
}

/**
 * 将简写参数定义转为标准 JSON Schema
 *
 * @example
 * ```typescript
 * // 输入
 * { path: "文件路径", force: { type: "boolean", description: "强制删除" } }
 *
 * // 输出
 * {
 *   type: "object",
 *   properties: {
 *     path: { type: "string", description: "文件路径" },
 *     force: { type: "boolean", description: "强制删除" },
 *   },
 *   required: ["path", "force"],
 * }
 * ```
 */
export function paramsToJsonSchema(params: ParamsDef): JSONSchema {
  // 空参数时返回最小有效 schema
  if (!params || Object.keys(params).length === 0) {
    return { type: "object", properties: {}, required: [] }
  }

  const properties: Record<string, any> = {}
  const required: string[] = []

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      properties[key] = { type: "string", description: value }
      required.push(key)
    } else {
      const spec = value as ParamSpec
      const prop: Record<string, any> = {
        type: spec.type,
        description: spec.description,
      }
      if (spec.items) {
        prop.items = spec.items
      }
      properties[key] = prop
      if (!spec.optional) {
        required.push(key)
      }
    }
  }

  return { type: "object", properties, required }
}
