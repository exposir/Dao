import { describe, it, expect } from "vitest"
import { tool, paramsToJsonSchema } from "./tool.js"

describe("paramsToJsonSchema", () => {
  it("应该把简写参数转为 JSON Schema", () => {
    const schema = paramsToJsonSchema({ path: "文件路径" })
    expect(schema).toEqual({
      type: "object",
      properties: {
        path: { type: "string", description: "文件路径" },
      },
      required: ["path"],
    })
  })

  it("应该支持完整参数定义", () => {
    const schema = paramsToJsonSchema({
      paths: { type: "array", description: "文件列表", items: { type: "string" } },
      force: { type: "boolean", description: "强制删除" },
    })
    expect(schema).toEqual({
      type: "object",
      properties: {
        paths: { type: "array", description: "文件列表", items: { type: "string" } },
        force: { type: "boolean", description: "强制删除" },
      },
      required: ["paths", "force"],
    })
  })

  it("应该支持 optional 参数", () => {
    const schema = paramsToJsonSchema({
      name: "名称",
      age: { type: "number", description: "年龄", optional: true },
    })
    expect(schema.required).toEqual(["name"])
  })

  it("应该支持混合简写和完整格式", () => {
    const schema = paramsToJsonSchema({
      path: "文件路径",
      content: { type: "string", description: "内容" },
    })
    expect(schema.required).toEqual(["path", "content"])
    expect(schema.properties.path.type).toBe("string")
  })
})

describe("tool", () => {
  it("应该创建正确的 ToolInstance", () => {
    const readFile = tool({
      name: "readFile",
      description: "读取文件",
      params: { path: "文件路径" },
      run: ({ path }) => `内容: ${path}`,
    })

    expect(readFile.__type).toBe("tool")
    expect(readFile.name).toBe("readFile")
    expect(readFile.description).toBe("读取文件")
    expect(readFile.confirm).toBe(false)
    expect(readFile.schema.properties.path.type).toBe("string")
  })

  it("execute 应该正确调用 run", async () => {
    const greet = tool({
      name: "greet",
      description: "打招呼",
      params: { name: "名字" },
      run: ({ name }) => `你好，${name}`,
    })

    const result = await greet.execute({ name: "世界" })
    expect(result).toBe("你好，世界")
  })

  it("应该支持异步 run", async () => {
    const asyncTool = tool({
      name: "async",
      description: "异步工具",
      params: { ms: { type: "number", description: "等待毫秒" } },
      run: async ({ ms }) => {
        await new Promise((r) => setTimeout(r, ms))
        return "done"
      },
    })

    const result = await asyncTool.execute({ ms: 10 })
    expect(result).toBe("done")
  })

  it("应该支持 confirm 选项", () => {
    const dangerous = tool({
      name: "delete",
      description: "删除",
      params: { path: "路径" },
      run: () => "deleted",
      confirm: true,
    })

    expect(dangerous.confirm).toBe(true)
  })
})
