/**
 * 内置工具单元测试
 */

import { describe, it, expect } from "vitest"
import { readFile, writeFile, listDir, runCommand, search } from "../src/tools/index.js"
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

  describe("listDir", () => {
    it("递归模式应该受 maxDepth 限制", async () => {
      setupTestDir()
      try {
        // maxDepth=0 只看当前目录
        const result0 = await listDir.execute({ dir: tmpDir, recursive: true, maxDepth: 0 })
        // 不应该包含深层文件
        expect(result0).not.toContain("b.txt")

        // maxDepth=1 只看一层子目录
        const result1 = await listDir.execute({ dir: tmpDir, recursive: true, maxDepth: 1 })
        expect(result1).toContain("sub1")
        expect(result1).toContain("a.txt")
        // deep/ 内的文件不应出现
        expect(result1).not.toContain("b.txt")

        // maxDepth=10（默认）应该看到所有
        const resultAll = await listDir.execute({ dir: tmpDir, recursive: true })
        expect(resultAll).toContain("b.txt")
      } finally {
        cleanupTestDir()
      }
    })
  })

  describe("search", () => {
    it("应该受 maxDepth 限制", async () => {
      setupTestDir()
      try {
        // maxDepth=0 只搜索根目录文件
        const result0 = await search.execute({ query: "hello", dir: tmpDir, maxDepth: 0 })
        expect(result0).toContain("root.txt")
        // 子目录的文件不应出现
        expect(result0).not.toContain("a.txt")

        // 默认搜索应该找到所有
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

  describe("readFile", () => {
    it("不存在的文件应该返回错误信息", async () => {
      const result = await readFile.execute({ path: "/tmp/nonexistent-dao-test-file.txt" })
      expect(result).toContain("错误")
    })
  })
})
