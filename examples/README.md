# Examples

每个文件都是一个独立可运行的示例。运行前确保已安装依赖并配置好 `.env`。

## 安装

```bash
npm install
cp .env.example .env   # 填入你的 API Key
```

## 示例列表

### [pr-reviewer.ts](pr-reviewer.ts) — PR 自动审查 ⭐

**杀手级示例。** 输入任意 GitHub PR URL，自动获取 diff 并生成结构化审查意见。

```bash
npx tsx examples/pr-reviewer.ts https://github.com/facebook/react/pull/32123
```

适合：Code Review 自动化、PR 机器人、Code Quality 流水线。

---

### [hello.ts](hello.ts) — 快速体验框架

**零门槛入门。** 4 个测试场景（聊天 / 工具调用 / 多轮记忆 / 流式输出），支持按场景单独运行。

```bash
npx tsx examples/hello.ts           # 全部场景
npx tsx examples/hello.ts --chat    # 仅聊天
npx tsx examples/hello.ts --stream  # 仅流式输出
npx tsx examples/hello.ts --help    # 查看所有选项
```

---

### [multi-tool.ts](multi-tool.ts) — 多工具协作

给 Agent 添加读文件、写文件、计算等工具能力，组合使用完成复杂任务。

```bash
npx tsx examples/multi-tool.ts
```

---

### [code-reviewer.ts](code-reviewer.ts) — 本地代码审查

基于本地文件系统的代码审查，支持单文件、目录和递归模式。

```bash
npx tsx examples/code-reviewer.ts                       # 审查默认文件（src/tool.ts）
npx tsx examples/code-reviewer.ts src/agent.ts         # 审查指定文件
npx tsx examples/code-reviewer.ts src/ --recursive      # 递归审查目录
npx tsx examples/code-reviewer.ts --help                # 查看帮助
```

---

### [translator.ts](translator.ts) — 多语言翻译

支持多轮记忆保持上下文风格（文学/商务/口语风格），支持单次翻译和批量翻译模式。

```bash
npx tsx examples/translator.ts                        # 演示多轮翻译
npx tsx examples/translator.ts "Hello world" zh      # 翻译为中文
npx tsx examples/translator.ts "你好" en            # 翻译为英文
npx tsx examples/translator.ts "你好" ja            # 翻译为日文
npx tsx examples/translator.ts --batch               # 批量翻译模式
npx tsx examples/translator.ts --help                # 查看帮助
```

---

### [multimodal.ts](multimodal.ts) — 多模态输入

支持图片 + 文本 + PDF 文件的混合输入，基于 Gemini 模型。支持网络图片、本地图片、PDF 文件、纯文本。

```bash
npx tsx examples/multimodal.ts                           # 使用 Wikipedia 示例图片
npx tsx examples/multimodal.ts --file ./docs/index.md    # 分析本地文件
npx tsx examples/multimodal.ts --url <图片URL>            # 分析指定网络图片
npx tsx examples/multimodal.ts --help                    # 查看帮助
```

> 多模态需要使用支持图片的模型（如 `google/gemini-2.0-flash`）。

---

### [mcp-tools.ts](mcp-tools.ts) — MCP 协议集成

通过 MCP（Model Context Protocol）桥接外部工具服务。内置完整 Mock MCP Server，无需额外安装任何 MCP 包即可完整演示。

```bash
npx tsx examples/mcp-tools.ts              # 使用内置 Mock Server（默认，无需任何额外依赖）
npx tsx examples/mcp-tools.ts --mock       # 同上，显式指定
npx tsx examples/mcp-tools.ts --url http://localhost:3100/sse  # 连接真实 MCP Server
npx tsx examples/mcp-tools.ts --help       # 查看帮助
```

Mock Server 提供 3 个工具：`get_weather`（天气）、`search_web`（搜索）、`get_news`（新闻）。

---

### [i18n.ts](i18n.ts) — 国际化

中英文模式切换，框架内置错误信息自动翻译，`t()` 函数支持多语言应用开发。

```bash
npx tsx examples/i18n.ts                # 中英文双语完整演示
npx tsx examples/i18n.ts --lang zh      # 仅中文模式
npx tsx examples/i18n.ts --lang en      # 仅英文模式
npx tsx examples/i18n.ts --help         # 查看帮助
```

---

### [retry-tool.ts](retry-tool.ts) — 工具级自动重试

指数退避重试包装器，给任何工具加稳定性，不改原始代码。同时演示 Plugin Hook 方案。

```bash
npx tsx examples/retry-tool.ts
```

---

### [batch.ts](batch.ts) — 批量任务 + 失败重试

限制并发数、只重试失败项，保留成功结果，适合跑批处理流水线。纯 Promise 实现，零外部依赖。

```bash
npx tsx examples/batch.ts
```

适合：数据导入、内容生成、API 调用批处理。

---

### [persistence.ts](persistence.ts) — 状态持久化

`state` 跨进程持久化，支持文件存储（零依赖）和 Redis 存储（分布式场景）。

```bash
npx tsx examples/persistence.ts                        # 文件存储模式（默认）
REDIS_URL=redis://localhost:6379 npx tsx examples/persistence.ts  # Redis 模式
```

适合：会话恢复、任务历史、多轮复杂工作流。

---

### [v25-features.ts](v25-features.ts) — V2.5 新特性演示

展示 V2.5 版本新增能力的合集：workspace / state / ask / Plugin 可变性。

```bash
npx tsx examples/v25-features.ts
```

---

### [streaming-sse.ts](streaming-sse.ts) — SSE 实时事件流

通过 Server-Sent Events 实时接收 `step_start` / `text` / `step_end` / `done` 事件，服务端和客户端双端演示，含背压处理和超时保护。

```bash
npx tsx examples/streaming-sse.ts
```

适合：终端 UI、实时日志、调试 Agent 运行过程。

---

### [server.ts](server.ts) — Fastify HTTP 服务端

将 Agent 接入 Fastify，提供 REST 和 SSE 两种调用方式，适合构建 API 服务。

```bash
npm install fastify @fastify/cors
npx tsx examples/server.ts
```

接口：`POST /api/chat`（同步）、`POST /api/chat/stream`（SSE）、`GET /health`。

适合：构建 API 服务、嵌入现有 Web 应用、部署到生产环境。

---

### [code-generator.ts](code-generator.ts) — 自然语言代码生成

输入自然语言需求，Agent 自动生成 TypeScript 代码，写入文件并验证语法。内置 `listSrc` / `writeCode` / `checkSyntax` 工具链。

```bash
npx tsx examples/code-generator.ts
npx tsx examples/code-generator.ts "写一个函数判断字符串是否是回文"
```

适合：快速原型生成、自动化脚手架、代码补全流水线。

---

### [db-query.ts](db-query.ts) — 自然语言 SQL 查询

内置 SQLite 演示，零外部依赖。输入自然语言问题，Agent 自动生成 SQL、执行并解释结果。内置 SQL 注入防护（仅允许 SELECT）。

```bash
npm install better-sqlite3 @types/better-sqlite3
npx tsx examples/db-query.ts
npx tsx examples/db-query.ts "哪些用户的订单总额超过 1000？"
```

适合：数据分析助手、BI 报表生成、数据库文档生成。

---

### [auto-test.ts](auto-test.ts) — 自动化测试生成

读取源代码，分析函数逻辑，生成 Vitest 测试用例，覆盖正常路径、边界值、空输入、异常输入。支持 dry-run 模式和递归目录处理。

```bash
npx tsx examples/auto-test.ts                                    # 使用默认文件
npx tsx examples/auto-test.ts src/agent.ts                      # 指定文件
npx tsx examples/auto-test.ts src/ --recursive                  # 递归处理目录
npx tsx examples/auto-test.ts --dry-run                         # 仅输出，不写入文件
npx tsx examples/auto-test.ts --help                            # 查看帮助
```

适合：测试驱动开发（TDD）、遗留代码补充测试、CI 流水线集成。

---

### [team.ts](team.ts) — 多 Agent 协作团队

将多个专业化 Agent 组成团队，lead Agent 负责分解任务并通过 delegate 工具调度成员执行。成员执行结果自动汇总。

```bash
npx tsx examples/team.ts                                      # 完整演示
npx tsx examples/team.ts "写一个待办事项 CLI 工具"             # 指定任务
npx tsx examples/team.ts --members                             # 仅列出团队成员
npx tsx examples/team.ts --stream                              # 流式演示
npx tsx examples/team.ts --help                                 # 查看帮助
```

团队成员：
- **planner** — 产品经理：分解需求，输出技术方案
- **coder** — 开发者：基于方案生成代码
- **reviewer** — 测试工程师：审查代码质量

适合：复杂任务分解、自动化流水线、多角色协作场景。

---

### [generate.ts](generate.ts) — 结构化输出

使用 `generate()` 让 Agent 直接返回符合 JSON Schema 的结构化数据，比 `chat()` 返回纯文本更可靠，适用于数据提取、分类、参数生成等需要程序化处理的场景。

```bash
npx tsx examples/generate.ts                      # 运行全部演示
npx tsx examples/generate.ts --extract            # 信息提取演示
npx tsx examples/generate.ts --classify           # 文本分类演示
npx tsx examples/generate.ts --code-review        # 代码审查评分
npx tsx examples/generate.ts --help                # 查看帮助
```

适用场景：数据提取（从文本中提取结构化信息）、分类/打标、参数生成、API 响应格式化。
