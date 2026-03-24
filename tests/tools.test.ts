/**
 * 内置工具单元测试
 */

import { describe, it, expect } from "vitest"
import { readFile, writeFile, deleteFile, listDir, runCommand, search, fetchUrl } from "../src/tools/index.js"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

describe("内置工具", () => {
  // 创建临时测试目录
  const tmpDir = path.join(os.tmpdir(), `dao-tools-test-${Date.now()}`)

  // 测试前创建目录结构
  function setupTestDir() {
    fs.mkdirSync(path.join(tmpDir, "sub1", "deep"), { recursive: true })
    fs.mkdirSync(path.join(tmpDir, "sub2"), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, "root.txt"), "hello root")
    fs.writeFileSync(path.join(tmpDir, "sub1", "a.txt"), "hello a")
    fs.writeFileSync(path.join(tmpDir, "sub1", "deep", "b.txt"), "hello b")
    fs.writeFileSync(path.join(tmpDir, "sub2", "c.txt"), "search keyword here")
  }

  // 测试后清理
  function cleanupTestDir() {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch { /* 忽略清理失败 */ }
  }

  describe("readFile", () => {
    it("应该读取文件内容", async () => {
      const testPath = path.join(os.tmpdir(), `dao-read-test-${Date.now()}.txt`)
      fs.writeFileSync(testPath, "hello dao")
      try {
        const result = await readFile.execute({ path: testPath })
        expect(result).toBe("hello dao")
      } finally {
        try { fs.unlinkSync(testPath) } catch { /* ignore */ }
      }
    })

    it("不存在的文件应该返回错误信息", async () => {
      const result = await readFile.execute({ path: "/tmp/nonexistent-dao-test-file.txt" })
      expect(result).toContain("错误")
    })
  })

  describe("writeFile", () => {
    it("应该创建文件并返回确认信息", async () => {
      const testPath = path.join(os.tmpdir(), `dao-write-test-${Date.now()}.txt`)
      try {
        const result = await writeFile.execute({ path: testPath, content: "hello dao" })
        expect(result).toContain("已写入")
        expect(fs.readFileSync(testPath, "utf-8")).toBe("hello dao")
      } finally {
        try { fs.unlinkSync(testPath) } catch { /* ignore */ }
      }
    })

    it("应该自动创建父目录", async () => {
      const deepDir = path.join(os.tmpdir(), `dao-write-deep-${Date.now()}`)
      const testPath = path.join(deepDir, "sub", "file.txt")
      try {
        const result = await writeFile.execute({ path: testPath, content: "deep write" })
        expect(result).toContain("已写入")
        expect(fs.existsSync(testPath)).toBe(true)
      } finally {
        try { fs.rmSync(deepDir, { recursive: true }) } catch { /* ignore */ }
      }
    })
  })

  describe("deleteFile", () => {
    it("应该成功删除存在的文件", async () => {
      const testPath = path.join(os.tmpdir(), `dao-delete-test-${Date.now()}.txt`)
      fs.writeFileSync(testPath, "to be deleted")
      const result = await deleteFile.execute({ path: testPath })
      expect(result).toContain("已删除")
      expect(fs.existsSync(testPath)).toBe(false)
    })

    it("删除不存在的文件应返回提示", async () => {
      const result = await deleteFile.execute({ path: "/tmp/dao-nonexistent-file-xyz.txt" })
      expect(result).toContain("文件不存在")
    })

    it("删除目录应返回错误提示", async () => {
      const testDir = path.join(os.tmpdir(), `dao-delete-dir-test-${Date.now()}`)
      fs.mkdirSync(testDir, { recursive: true })
      try {
        const result = await deleteFile.execute({ path: testDir })
        expect(result).toContain("是目录")
        expect(result).toContain("不能用 deleteFile 删除")
        expect(fs.existsSync(testDir)).toBe(true)
      } finally {
        try { fs.rmdirSync(testDir) } catch { /* ignore */ }
      }
    })
  })

  describe("listDir", () => {
    it("递归模式应该受 maxDepth 限制", async () => {
      setupTestDir()
      try {
        const result0 = await listDir.execute({ dir: tmpDir, recursive: true, maxDepth: 0 })
        expect(result0).not.toContain("b.txt")

        const result1 = await listDir.execute({ dir: tmpDir, recursive: true, maxDepth: 1 })
        expect(result1).toContain("sub1")
        expect(result1).toContain("a.txt")
        expect(result1).not.toContain("b.txt")

        const resultAll = await listDir.execute({ dir: tmpDir, recursive: true })
        expect(resultAll).toContain("b.txt")
      } finally {
        cleanupTestDir()
      }
    })
  })

  describe("runCommand", () => {
    it("应该异步执行命令并返回结果", async () => {
      const result = await runCommand.execute({ command: "echo hello" })
      expect(result).toContain("hello")
    })

    it("命令失败应该返回错误信息而不是抛错", async () => {
      const result = await runCommand.execute({ command: "false" })
      expect(result).toContain("命令执行失败")
    })

    it("应该支持 cwd 参数", async () => {
      const result = await runCommand.execute({ command: "pwd", cwd: "/tmp" })
      expect(result).toMatch(/tmp/)
    })
  })

  describe("search", () => {
    it("应该受 maxDepth 限制", async () => {
      setupTestDir()
      try {
        const result0 = await search.execute({ query: "hello", dir: tmpDir, maxDepth: 0 })
        expect(result0).toContain("root.txt")
        expect(result0).not.toContain("a.txt")

        const resultAll = await search.execute({ query: "hello", dir: tmpDir })
        expect(resultAll).toContain("root.txt")
        expect(resultAll).toContain("a.txt")
        expect(resultAll).toContain("b.txt")
      } finally {
        cleanupTestDir()
      }
    })

    it("应该支持 ext 扩展名过滤", async () => {
      setupTestDir()
      fs.writeFileSync(path.join(tmpDir, "test.js"), "hello js")
      try {
        const result = await search.execute({ query: "hello", dir: tmpDir, ext: ".js" })
        expect(result).toContain("test.js")
        expect(result).not.toContain("root.txt")
      } finally {
        cleanupTestDir()
      }
    })
  })

  describe("fetchUrl", () => {
    it("应该成功请求公开 URL", async () => {
      const result = await fetchUrl.execute({ url: "https://httpbin.org/get" })
      expect(result).toContain("httpbin.org")
    }, 20000)

    it("无效 URL 应返回错误信息", async () => {
      const result = await fetchUrl.execute({ url: "https://this-domain-does-not-exist-dao-test.invalid" })
      expect(result).toContain("请求失败")
    }, 20000)

    it("HTTP 错误应返回状态码", async () => {
      const result = await fetchUrl.execute({ url: "https://httpbin.org/status/404" })
      expect(result).toContain("404")
    }, 20000)
  })
})
