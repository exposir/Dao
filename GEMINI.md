# Dao 项目指南

## 项目概述

Dao 是一个直觉优先、渐进式的 TypeScript AI Agent 框架。基于 Vercel AI SDK 构建。

## 技术栈

- **语言**：TypeScript（严格模式）
- **运行时**：Node.js
- **核心依赖**：Vercel AI SDK (`ai`)
- **模型 Provider**：`@ai-sdk/openai`（DeepSeek 兼容模式）、`@ai-sdk/google` 等（按需安装）

## 项目结构

```
src/
├── types.ts      # 所有类型定义
├── tool.ts       # tool() + paramsToJsonSchema
├── model.ts      # 模型解析（provider/model 格式）
├── config.ts     # configure() 全局配置
├── loop.ts       # Agent Loop 核心循环
├── agent.ts      # agent() 入口
├── index.ts      # 导出入口
├── engine.ts     # Steps 引擎（V0.5 计划）
├── rules.ts      # Rules 系统（V0.5 计划）
├── plugin.ts     # 插件系统（V1.0 计划）
└── team.ts       # team() 系统（V1.0 计划）
```

## 设计原则

1. **所有公开 API 接收单个对象参数**：`agent({...})`、`tool({...})`、`plugin({...})`
2. **工厂函数，不用 class**：`agent()` 不是 `new Agent()`
3. **不依赖 Zod**：参数定义用简写语法，框架内部转 JSON Schema
4. **rules.reject 是 prompt 注入**：不做硬拦截，注入到 system prompt
5. **步骤完成用 maxTurns 兜底**：不依赖 LLM 输出特殊标记
6. **默认继续执行**：单步失败不终止流程，强依赖用 `ctx.abort()`
7. **闭包封装**：用闭包共享状态，不暴露内部属性

> 完整设计模式和原则见 [docs/principles.md](./docs/principles.md)

## 编码规范

- 使用 ESM（`import`/`export`）
- 函数优先，避免 class（除非必要）
- 所有类型定义集中在 `types.ts`
- 文件级别单一职责

## 版本阶段

- **V0.1**：agent + tool + loop + model + 基础 memory
- **V0.5**：steps 引擎 + rules + 上下文压缩 + wait/resume
- **V1.0**：team + plugins + 内置工具 + 完整文档

## 重要约定

- **中文注释**：代码注释和文档优先使用中文
- **文档在 `docs/` 目录**：设计文档、API 文档、路线图都在 docs/ 下
- **logger 是工厂函数**：`logger()` 返回插件实例，不是直接导出实例
- **delegate 工具返回 output 字符串**：team 层另外收集完整 RunResult

## 规范文件

本项目有三份 AI 编码工具规范文件，内容保持一致：

- `CLAUDE.md` — Claude Code
- `AGENTS.md` — Codex
- `GEMINI.md` — Gemini CLI / Antigravity

修改任一文件时，必须同步更新其他两份。
