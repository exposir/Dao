/**
 * 道（Dao）— PR 自动审查 Agent
 *
 * 输入 GitHub PR URL，自动获取 diff 并生成结构化审查意见。
 * 演示：fetchUrl 工具 + 多步骤流程 + rules 约束
 *
 * 运行：
 *   npx tsx examples/pr-reviewer.ts
 *
 * 依赖：GITHUB_TOKEN（可选，用于私有仓库）
 */

import "dotenv/config"
import { agent, tool } from "dao-ai"
import { readFile, writeFile, listDir } from "dao-ai/tools"

// 从 GitHub API 获取 PR 信息和文件列表
const fetchPRDetails = tool({
  name: "fetchPRDetails",
  description: "获取 GitHub PR 的详细信息（标题、描述、变更文件列表）",
  params: { prUrl: "GitHub PR URL，格式如 https://github.com/owner/repo/pull/123" },
  run: async ({ prUrl }) => {
    const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
    if (!match) return "错误：无效的 GitHub PR URL"

    const [, owner, repo, prNumber] = match
    const token = process.env.GITHUB_TOKEN

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Dao-AI-Agent",
    }
    if (token) headers["Authorization"] = `Bearer ${token}`

    // 获取 PR 基础信息
    const prRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
      { headers }
    )
    if (!prRes.ok) {
      return `错误：无法获取 PR 信息（${prRes.status}）`
    }
    const pr = await prRes.json() as {
      title: string
      body: string
      state: string
      additions: number
      deletions: number
      changed_files: number
      user: { login: string }
    }

    // 获取变更文件列表
    const filesRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`,
      { headers }
    )
    const files = filesRes.ok
      ? await filesRes.json() as { filename: string; status: string; additions: number; deletions: number }[]
      : []

    return [
      `## PR 概览`,
      `**标题**: ${pr.title}`,
      `**作者**: @${pr.user.login}`,
      `**状态**: ${pr.state}`,
      `**变更**: ${pr.additions} 行新增 / ${pr.deletions} 行删除 / ${pr.changed_files} 个文件`,
      ``,
      `**描述**:\n${pr.body || "(无描述)"}`,
      ``,
      `## 变更文件`,
      files.map(f => `- [${f.status}] ${f.filename} (+${f.additions} / -${f.deletions})`).join("\n"),
    ].join("\n")
  },
})

// 获取单个文件的 diff
const fetchFileDiff = tool({
  name: "fetchFileDiff",
  description: "获取某个文件在 PR 中的代码变更（diff）",
  params: {
    prUrl: "GitHub PR URL",
    filePath: "要查看的文件路径",
  },
  run: async ({ prUrl, filePath }) => {
    const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
    if (!match) return "错误：无效的 GitHub PR URL"

    const [, owner, repo, prNumber] = match
    const token = process.env.GITHUB_TOKEN

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3.diff",
      "User-Agent": "Dao-AI-Agent",
    }
    if (token) headers["Authorization"] = `Bearer ${token}`

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`,
      { headers }
    )
    if (!res.ok) return `错误：无法获取 diff（${res.status}）`

    const files = await res.json() as { filename: string; patch?: string; changes?: string }[]

    // 支持模糊匹配（如 src/foo.ts 匹配 src/foo.ts 或 src/foo.tsx）
    const file = files.find(
      f => f.filename === filePath || f.filename.startsWith(filePath.replace(/\.[^.]+$/, "."))
    )

    if (!file) return `文件 ${filePath} 不在此次变更中`

    return file.patch || file.changes || "(无详细 diff)"
  },
})

const prReviewer = agent({
  role: "资深代码审查员",
  goal: "发现代码中的 bug、安全隐患、性能问题，并提出建设性改进建议",
  background: [
    "你有 15 年编程经验，精通 TypeScript、Node.js 和系统设计",
    "你审查过 1000+ Pull Request，擅长发现边界条件和潜在风险",
    "你熟悉 OWASP Top 10 安全漏洞和常见性能反模式",
    "你的审查风格：直接、具体、有例子，帮助作者而不是挑剔",
  ].join("；"),
  model: "deepseek/deepseek-chat",
  tools: [fetchPRDetails, fetchFileDiff, readFile, writeFile, listDir],
  rules: {
    focus: [
      "逻辑错误和边界条件",
      "安全漏洞（如注入、XSS、敏感信息泄露）",
      "性能问题（如 N+1 查询、同步阻塞）",
      "可读性和可维护性",
      "类型安全（TypeScript 最佳实践）",
    ],
    reject: [
      "不要修改任何代码",
      "不要批评作者，只指出问题",
      "不要要求作者添加过度工程化的设计",
    ],
  },
  maxTurns: 20,
})

async function main() {
  const prUrl = process.argv[2]

  if (!prUrl) {
    console.log("用法: npx tsx examples/pr-reviewer.ts <GitHub PR URL>\n")
    console.log("示例:")
    console.log("  npx tsx examples/pr-reviewer.ts https://github.com/facebook/react/pull/32123")
    console.log("  GITHUB_TOKEN=xxx npx tsx examples/pr-reviewer.ts https://github.com/your/private-repo/pull/45\n")
    console.log("环境变量:")
    console.log("  GITHUB_TOKEN  可选，用于访问私有仓库（可在 .env 中设置）")
    return
  }

  console.log(`\n🔍 开始审查 PR: ${prUrl}\n`)

  const result = await prReviewer.run(
    [
      `请审查这个 GitHub Pull Request：${prUrl}`,
      "",
      "第一步：调用 fetchPRDetails 获取 PR 概览",
      "第二步：从变更文件列表中找出最重要的 3-5 个文件（优先 .ts/.tsx 文件，跳过 node_modules、dist、lock 文件）",
      "第三步：对每个关键文件调用 fetchFileDiff 获取详细 diff",
      "第四步：结合 PR 描述和代码变更，给出结构化的审查意见",
      "",
      "输出格式：",
      "## 总体评价",
      "## 关键问题（按严重程度排列，每个问题说明：位置、问题、建议修复方式）",
      "## 次要建议",
      "## 值得肯定的地方",
    ].join("\n")
  )

  console.log("\n📋 审查结果：\n")
  console.log(result.output)
  console.log(`\n⏱️  耗时: ${(result.duration / 1000).toFixed(1)}s | tokens: ${result.usage.totalTokens}`)
}

main().catch(console.error)
