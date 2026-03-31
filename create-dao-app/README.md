# create-dao-app

Dao 框架的官方项目脚手架。一行命令创建基于 Dao 的 AI 助手项目。

## 功能特性

- **交互式创建** — 问答式配置，无需记忆参数
- **零依赖** — 纯 Node.js，无外部 CLI 依赖（无 inquirer、无 prompts）
- **渐进式模板** — 生成的代码展示 `chat()` → `tools` → `rules` → `memory` 的演进路径
- **模型可选** — DeepSeek / OpenAI / Google Gemini 一键切换
- **工具自选** — 按需选择内置工具，不过度配置

## 使用方式

### 从 npm 安装（推荐）

```bash
npx create-dao-app
```

### 从源码运行（Dao 开发者）

```bash
git clone https://github.com/exposir/Dao.git
cd Dao
npm install
npm run create-dao-app
```

## 命令行参数（非交互模式）

```bash
# 完整指定
npx create-dao-app --name my-bot --role "代码助手" --goal "帮助开发者写代码" --model deepseek/deepseek-chat

# 指定工具
npx create-dao-app --name data-agent --tools readFile,webSearch,calculator

# 跳过依赖安装（克隆后快速试用）
npx create-dao-app --name my-app --no-install
```

## 交互式配置项

| 问题 | 说明 | 默认值 |
|------|------|--------|
| 项目名称 | 目录名，只允许字母/数字/连字符 | `my-dao-app` |
| 助手身份 | `role` 字段，AI 的角色定位 | `智能助手` |
| 助手目标 | `goal` 字段，AI 的任务目标 | `尽我所能帮助用户完成各种任务` |
| 模型 | 模型选择 | `deepseek` |
| 内置工具 | 多选，逗号分隔 | `readFile,listDir,runCommand,webSearch,calculator` |

## 生成的项目结构

```
my-app/
├── package.json       # dao-ai 作为 workspace 依赖
├── tsconfig.json
├── .env.example       # API Key 配置模板
├── .gitignore
└── src/
    ├── index.ts       # 入口：REPL + 命令行模式
    ├── agent.ts       # Agent 配置
    └── tools.ts       # 自定义工具
```

## 模板特点

- **美观 REPL** — 纯 ANSI 颜色化输出，无需 chalk/inquirer
- **流式输出** — 默认开启流式，文字逐字显示
- **内置命令** — `exit` / `clear` / `token` / `reset`
- **渐进代码** — `agent.ts` 中有注释说明从 `chat()` 到 `team()` 的演进路径
- **工具模板** — `tools.ts` 中有添加新工具的完整代码模板

## 技术细节

- **无外部依赖** — `index.js` 仅使用 Node.js 内置模块（`fs`、`path`、`readline`）
- **纯 CommonJS** — `index.js` 用 `require()` 语法，确保 Node.js 18+ 直接运行
- **ANSI 转义码** — 颜色化输出，无任何外部包
- **模板 CJS → ESM** — 模板本身是完整 ESM TypeScript 项目

## 设计哲学

模板生成的是**真实可用的起点**，不是 hello world：

```
npm run dev
```

即可进入一个带颜色的交互式 AI 助手，支持：

- 多轮对话（memory）
- 文件读取、网络搜索、计算器
- 行为约束（rules）
- 流式输出

从第一行代码开始就能用，在使用中逐步理解 Dao 的渐进式复杂度设计。
