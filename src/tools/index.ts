/**
 * 道（Dao）— 内置工具
 *
 * 开箱即用的常用工具集合。
 * 使用方式：import { readFile, writeFile, deleteFile, listDir, runCommand, search, fetchUrl } from "dao-ai/tools"
 */

import { tool } from "../tool.js"
import * as fs from "fs"
import * as path from "path"
import { exec } from "child_process"
import { promisify } from "util"

const execPromise = promisify(exec)

/** 读取文件内容 */
export const readFile = tool({
  name: "readFile",
  description: "读取指定路径的文件内容并返回。支持文本文件。",
  params: {
    path: "文件的绝对或相对路径",
    encoding: { type: "string", description: "编码格式，默认 utf-8", optional: true },
  },
  run: ({ path: filePath, encoding }) => {
    try {
      return fs.readFileSync(filePath, (encoding as BufferEncoding) ?? "utf-8")
    } catch (err: any) {
      return `错误：无法读取文件 ${filePath} — ${err.message}`
    }
  },
})

/** 写入文件内容 */
export const writeFile = tool({
  name: "writeFile",
  description: "将内容写入指定路径的文件。如果文件不存在会自动创建，如果父目录不存在也会自动创建。",
  params: {
    path: "文件路径",
    content: "要写入的内容",
  },
  run: ({ path: filePath, content }) => {
    try {
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(filePath, content, "utf-8")
      return `已写入 ${filePath}（${content.length} 字符）`
    } catch (err: any) {
      return `错误：无法写入文件 ${filePath} — ${err.message}`
    }
  },
})

/** 删除文件 */
export const deleteFile = tool({
  name: "deleteFile",
  description: "删除指定路径的文件。只能删除文件，不能删除目录。如果文件不存在会返回提示而非报错。",
  params: {
    path: "要删除的文件路径",
  },
  run: ({ path: filePath }) => {
    try {
      if (!fs.existsSync(filePath)) {
        return `文件不存在：${filePath}`
      }
      const stat = fs.statSync(filePath)
      if (stat.isDirectory()) {
        return `错误：${filePath} 是目录，不能用 deleteFile 删除。请使用 runCommand 执行 rm -rf。`
      }
      fs.unlinkSync(filePath)
      return `已删除 ${filePath}`
    } catch (err: any) {
      return `错误：无法删除文件 ${filePath} — ${err.message}`
    }
  },
})

/** 列出目录内容 */
export const listDir = tool({
  name: "listDir",
  description: "列出指定目录下的所有文件和子目录。",
  params: {
    dir: "目录路径",
    recursive: { type: "boolean", description: "是否递归列出子目录，默认 false", optional: true },
    maxDepth: { type: "number", description: "递归最大深度，默认 10", optional: true },
  },
  run: ({ dir, recursive, maxDepth }) => {
    try {
      if (recursive) {
        const maxLevel = maxDepth ?? 10
        const results: string[] = []
        function walk(d: string, indent: string, depth: number) {
          if (depth > maxLevel) return
          const entries = fs.readdirSync(d, { withFileTypes: true })
          for (const e of entries) {
            if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "dist") continue
            const icon = e.isDirectory() ? "📁" : "📄"
            results.push(`${indent}${icon} ${e.name}`)
            if (e.isDirectory()) {
              walk(path.join(d, e.name), indent + "  ", depth + 1)
            }
          }
        }
        walk(dir, "", 0)
        return results.join("\n")
      }

      const entries = fs.readdirSync(dir, { withFileTypes: true })
      return entries
        .map(e => `${e.isDirectory() ? "📁" : "📄"} ${e.name}`)
        .join("\n")
    } catch (err: any) {
      return `错误：无法读取目录 ${dir} — ${err.message}`
    }
  },
})

/** 执行命令（异步，不阻塞事件循环） */
export const runCommand = tool({
  name: "runCommand",
  description: "在系统 shell 中执行命令并返回输出。注意：此工具具有系统级权限，请谨慎使用。",
  params: {
    command: "要执行的命令",
    cwd: { type: "string", description: "工作目录，默认为当前目录", optional: true },
  },
  run: async ({ command, cwd }) => {
    try {
      const { stdout, stderr } = await execPromise(command, {
        cwd: cwd ?? process.cwd(),
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      })
      // 合并 stdout 和 stderr，都返回（避免丢失部分输出）
      const out = stdout.trim()
      const err = stderr.trim()
      if (out && err) return `${out}\n---stderr---\n${err}`
      return out || err || "(命令执行成功，无输出)"
    } catch (err: any) {
      // exec 非零退出时 err 包含 stdout 和 stderr，都要返回
      const parts = [`命令执行失败：${err.message}`]
      if (err.stdout?.trim()) parts.push(err.stdout.trim())
      if (err.stderr?.trim()) parts.push(`---stderr---\n${err.stderr.trim()}`)
      return parts.join("\n")
    }
  },
})

/** 搜索文件内容 */
export const search = tool({
  name: "search",
  description: "在指定目录中搜索包含关键词的文件，返回匹配的文件名和行号。",
  params: {
    query: "搜索关键词",
    dir: { type: "string", description: "搜索目录，默认为当前目录", optional: true },
    ext: { type: "string", description: "文件扩展名过滤，如 .ts .js", optional: true },
    maxDepth: { type: "number", description: "最大搜索深度，默认 10", optional: true },
  },
  run: ({ query, dir, ext, maxDepth }) => {
    const searchDir = dir ?? "."
    const maxLevel = maxDepth ?? 10
    const results: string[] = []

    function searchFile(filePath: string) {
      try {
        const content = fs.readFileSync(filePath, "utf-8")
        const lines = content.split("\n")
        lines.forEach((line, i) => {
          if (line.includes(query)) {
            results.push(`${filePath}:${i + 1}: ${line.trim()}`)
          }
        })
      } catch { /* skip binary files */ }
    }

    const skipDirs = new Set(["node_modules", "dist", ".git", ".next", ".cache"])

    function walk(d: string, depth: number) {
      if (depth > maxLevel) return
      try {
        const entries = fs.readdirSync(d, { withFileTypes: true })
        for (const e of entries) {
          if (skipDirs.has(e.name)) continue
          const fullPath = path.join(d, e.name)
          if (e.isDirectory()) {
            walk(fullPath, depth + 1)
          } else {
            if (ext && !e.name.endsWith(ext)) continue
            searchFile(fullPath)
          }
        }
      } catch { /* skip inaccessible dirs */ }
    }

    walk(searchDir, 0)
    return results.length > 0
      ? results.slice(0, 50).join("\n") + (results.length > 50 ? `\n... 还有 ${results.length - 50} 条结果` : "")
      : `未找到包含 "${query}" 的内容`
  },
})

/** HTTP 请求 */
export const fetchUrl = tool({
  name: "fetchUrl",
  description: "发起 HTTP 请求获取网页内容或 API 数据。传入完整 URL（含 https://）。默认 GET 请求。如果返回错误状态码，根据错误信息调整 URL 或参数后重试。返回内容为纯文本，最大 100KB。",
  params: {
    url: "完整的请求 URL，必须包含协议（https:// 或 http://）",
    method: { type: "string", description: "请求方法：GET 或 POST，默认 GET", optional: true },
    body: { type: "string", description: "POST 请求体，JSON 字符串格式", optional: true },
    headers: { type: "string", description: "自定义请求头，JSON 字符串格式", optional: true },
  },
  run: async ({ url, method, body, headers }) => {
    try {
      const opts: RequestInit = {
        method: method ?? "GET",
        signal: AbortSignal.timeout(15000),
      }
      if (body) opts.body = body
      if (headers) {
        try { opts.headers = JSON.parse(headers) } catch { /* 忽略无效 headers */ }
      }
      if (body && !opts.headers) {
        opts.headers = { "Content-Type": "application/json" }
      }

      const res = await fetch(url, opts)
      if (!res.ok) {
        return `HTTP ${res.status} ${res.statusText} — ${url}`
      }

      const text = await res.text()
      // 截断过长的响应
      const maxLen = 100_000
      if (text.length > maxLen) {
        return text.slice(0, maxLen) + `\n\n... 内容过长，已截断（共 ${text.length} 字符）`
      }
      return text
    } catch (err: any) {
      return `请求失败：${err.message} — ${url}`
    }
  },
})
