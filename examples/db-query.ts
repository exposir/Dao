/**
 * 自然语言数据库查询示例
 *
 * 输入自然语言问题，自动生成 SQL、执行并返回结果。
 * 内置 SQLite 演示，零外部依赖。
 *
 * 运行：npx tsx examples/db-query.ts
 */

import "dotenv/config"
import { agent, tool } from "dao-ai"
import Database from "better-sqlite3"

// 初始化示例数据库
const db = new Database(":memory:")

db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    age INTEGER,
    city TEXT,
    created_at TEXT DEFAULT (date('now'))
  );

  CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    product TEXT,
    amount REAL,
    status TEXT,
    created_at TEXT DEFAULT (date('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  INSERT INTO users (name, email, age, city) VALUES
    ('张三', 'zhang@example.com', 28, '北京'),
    ('李四', 'li@example.com', 35, '上海'),
    ('王五', 'wang@example.com', 22, '北京'),
    ('赵六', 'zhao@example.com', 41, '深圳'),
    ('孙七', 'sun@example.com', 30, '上海');

  INSERT INTO orders (user_id, product, amount, status) VALUES
    (1, '鼠标', 199, 'completed'),
    (1, '键盘', 599, 'completed'),
    (2, '显示器', 2499, 'pending'),
    (3, '耳机', 299, 'completed'),
    (4, '笔记本', 8999, 'completed'),
    (4, '鼠标垫', 49, 'cancelled'),
    (5, '摄像头', 399, 'completed');
`)

// 工具：查看表结构
const showSchema = tool({
  name: "showSchema",
  description: "查看数据库表结构（CREATE TABLE 语句）",
  params: { table: { type: "string", description: "表名" } },
  run: ({ table }) => {
    const schema = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(table) as any
    return schema?.sql ?? `表 ${table} 不存在`
  },
})

// 工具：执行 SQL 查询
const executeQuery = tool({
  name: "executeQuery",
  description: "执行 SQL 查询（仅 SELECT，禁止修改数据）",
  params: { sql: { type: "string", description: "SQL 查询语句" } },
  run: ({ sql }) => {
    const trimmed = sql.trim().toLowerCase()
    if (!trimmed.startsWith("select")) {
      return "❌ 只允许 SELECT 查询"
    }
    try {
      const rows = db.prepare(sql).all()
      if (rows.length === 0) return "查询结果为空"
      return JSON.stringify(rows, null, 2)
    } catch (e: any) {
      return `❌ SQL 错误：${e.message}`
    }
  },
})

// 工具：列出所有表
const listTables = tool({
  name: "listTables",
  description: "列出数据库中所有表名",
  params: {},
  run: () => {
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).all()
    return (tables as any[]).map(r => r.name).join(", ")
  },
})

const dbBot = agent({
  role: "数据分析助手",
  goal: "将自然语言问题转化为精确的 SQL 查询并执行",
  background: [
    "你擅长 SQL，熟悉常见查询模式：聚合、分组、子查询、JOIN",
    "你会先用 listTables 和 showSchema 了解数据库结构",
    "你会用 executeQuery 执行查询，最后用自然语言解释结果",
  ].join("。"),
  model: "deepseek/deepseek-chat",
  tools: [showSchema, executeQuery, listTables],
  rules: {
    focus: ["查询效率", "结果准确性"],
    reject: ["禁止 INSERT/UPDATE/DELETE/DROP", "禁止执行任何非 SELECT 语句"],
  },
  maxTurns: 10,
})

async function main() {
  const question = process.argv.slice(2).join(" ") ||
    "每个城市的用户数量和平均年龄是多少？并列出订单总额"

  console.log("❓ 问题：", question)
  console.log("\n⏳ 查询中...\n")

  const result = await dbBot.run(
    `请回答以下数据库问题：\n\n${question}\n\n` +
    "步骤：\n" +
    "1. 用 listTables 了解有哪些表\n" +
    "2. 用 showSchema 查看相关表结构\n" +
    "3. 用 executeQuery 执行查询\n" +
    "4. 用自然语言解释查询结果"
  )

  console.log(result.output)
  console.log(`\n耗时: ${result.duration}ms | tokens: ${result.usage.totalTokens}`)
  db.close()
}

main().catch(console.error)
