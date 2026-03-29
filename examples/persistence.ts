/**
 * 道（Dao）— 状态持久化
 *
 * Dao 的 state / workspace 是内存 Map，进程重启即丢失。
 * 本示例演示两种持久化方案，让多次 run 之间共享状态成为可能：
 *
 *   1. 文件持久化（零依赖，最简方案）
 *   2. Redis 持久化（分布式 / 多进程场景）
 *
 * 运行：
 *   npx tsx examples/persistence.ts           # 文件模式（默认）
 *   REDIS_URL=redis://localhost:6379 npx tsx examples/persistence.ts  # Redis 模式
 */

import "dotenv/config"
import { agent } from "dao-ai"
import fs from "node:fs/promises"
import path from "node:path"

// ============================================================
// 持久化存储抽象
// ============================================================

interface Storage {
  /** 读取所有数据 */
  read(): Promise<Record<string, any>>
  /** 写入所有数据（完整覆盖） */
  write(data: Record<string, any>): Promise<void>
  /** 关闭连接（如有） */
  close?(): Promise<void>
}

// ============================================================
// 1. 文件存储（零依赖，适合本地/单进程）
// ============================================================

class FileStorage implements Storage {
  private filePath: string

  constructor(filePath = "./dao-state.json") {
    this.filePath = filePath
  }

  async read(): Promise<Record<string, any>> {
    try {
      const raw = await fs.readFile(this.filePath, "utf-8")
      return JSON.parse(raw)
    } catch {
      // 文件不存在或损坏，返回空状态
      return {}
    }
  }

  async write(data: Record<string, any>): Promise<void> {
    // 原子写入：先写临时文件再 rename，避免并发写入导致文件损坏
    const tmp = `${this.filePath}.tmp`
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8")
    await fs.rename(tmp, this.filePath)
  }

  async close(): Promise<void> {
    // 无需关闭
  }
}

// ============================================================
// 2. Redis 存储（ioredis，可选依赖）
// ============================================================

class RedisStorage implements Storage {
  private redis: any
  private prefix: string

  constructor(url: string, prefix = "dao:state:") {
    // ioredis 是可选依赖，未安装时提示用户
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Redis = require("ioredis")
      this.redis = new Redis(url)
      this.prefix = prefix
    } catch {
      throw new Error(
        "ioredis 未安装。运行: npm install ioredis\n" +
        "或使用文件存储模式（默认）：npx tsx examples/persistence.ts"
      )
    }
  }

  async read(): Promise<Record<string, any>> {
    const keys = await this.redis.keys(`${this.prefix}*`)
    if (!keys.length) return {}

    const values = await this.redis.mget(keys)
    const result: Record<string, any> = {}
    keys.forEach((k: string, i: number) => {
      const key = k.replace(this.prefix, "")
      try {
        result[key] = JSON.parse(values[i] ?? "null")
      } catch {
        result[key] = values[i]
      }
    })
    return result
  }

  async write(data: Record<string, any>): Promise<void> {
    const pipeline = this.redis.pipeline()
    for (const [k, v] of Object.entries(data)) {
      pipeline.set(`${this.prefix}${k}`, JSON.stringify(v))
    }
    await pipeline.exec()
  }

  async close(): Promise<void> {
    await this.redis.quit()
  }
}

// ============================================================
// 持久化 Agent 工厂
// ============================================================

/**
 * 创建一个 Agent，其 state 自动同步到持久化存储。
 *
 * 策略：
 *   - run() 开始前：从存储加载 state 到内存
 *   - run() 结束后：将内存 state 写回存储
 *
 * @param storage 存储后端（FileStorage 或 RedisStorage）
 */
function createPersistentAgent(
  storage: Storage
) {
  let state = new Map<string, any>()

  // 启动时加载已有状态
  ;(async () => {
    const persisted = await storage.read()
    state = new Map(Object.entries(persisted))
    console.log(`[persistence] 加载 ${state.size} 条已有状态`)
  })()

  const bot = agent({
    model: "deepseek/deepseek-chat",
    role: "任务助理",
    state,            // 共享同一个 Map 实例
    maxTurns: 10,
  })

  // 包装 run 方法，在结束后自动保存
  const originalRun = bot.run.bind(bot)

  bot.run = async (input: string) => {
    const result = await originalRun(input)
    // run 完成后同步写回存储
    await storage.write(Object.fromEntries(state))
    return result
  }

  // 可选：暴露 close 方法
  bot.close = async () => {
    await storage.write(Object.fromEntries(state))
    await storage.close?.()
  }

  return bot
}

// ============================================================
// 演示：多轮对话记住上下文
// ============================================================

async function main() {
  const redisUrl = process.env.REDIS_URL
  const storage: Storage = redisUrl
    ? new RedisStorage(redisUrl)
    : new FileStorage("./dao-persistence-demo.json")

  console.log(`=== 状态持久化演示（${redisUrl ? "Redis" : "文件"} 模式）===\n`)

  const bot = createPersistentAgent(storage)

  // 第一轮：告诉 Agent 一些上下文
  console.log("【第一轮】设定上下文\n")
  await bot.run(
    `我叫张三，我的公司叫"星辰科技"，我正在开发一个 AI Agent 框架。` +
    `记住这些信息，后续对话中会用到。`
  )
  console.log(`  state: ${JSON.stringify([...bot.state.entries()])}\n`)

  // 第二轮：不提供任何上下文，看 Agent 是否能记住
  console.log("【第二轮】验证记忆\n")
  const r2 = await bot.run("我是谁？我的公司叫什么？")
  console.log(`  Agent 回答: ${r2.output}\n`)

  // 第三轮：累积更多状态
  console.log("【第三轮】追加任务历史\n")
  await bot.run("我刚完成 V2.5 版本的发布，记住这个里程碑。")
  console.log(`  state: ${JSON.stringify([...bot.state.entries()])}\n`)

  // 关闭连接（文件模式无需调用）
  await bot.close?.()

  // 演示进程重启后状态依然存在（重新创建 Agent）
  console.log("【进程重启模拟】创建新 Agent 实例\n")
  const bot2 = createPersistentAgent(storage)
  await new Promise(r => setTimeout(r, 200)) // 等待异步加载

  const r3 = await bot2.run("我之前说的公司名是什么？最新里程碑是什么？")
  console.log(`  Agent 回答: ${r3.output}`)
  await bot2.close?.()
}

main().catch(console.error)
