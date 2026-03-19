# Dao 文档目录

## 总览

| 文档 | 说明 |
|---|---|
| [design.md](./design.md) | **整体设计** — 项目定位、核心理念、API 设计、技术架构、竞品对比 |
| [roadmap.md](./roadmap.md) | **开发路线图** — V0.1/V0.5/V1.0 里程碑、12 步开发计划、交付物 |

## 模块文档

| 文档 | 说明 |
|---|---|
| [api.md](./api.md) | **API 类型定义** — agent / team / tool / plugin 的完整 TypeScript 类型和参数说明 |
| [engine.md](./engine.md) | **Steps 引擎** — 每种步骤类型的行为定义、执行流程、数据传递、错误处理 |
| [agent-loop.md](./agent-loop.md) | **Agent Loop** — 核心循环、prompt 组装、Grace Period、工具调用流程、流式输出 |
| [tools.md](./tools.md) | **工具系统** — tool() 定义、参数转 JSON Schema、执行安全、内置工具 |
| [team.md](./team.md) | **团队系统** — lead 自动生成、成员通信、调度流程 |
| [plugins.md](./plugins.md) | **插件系统** — hook 生命周期、示例插件、执行顺序 |
| [model.md](./model.md) | **模型层** — provider 注册表、模型解析、默认模型、自定义 provider |

## 阶段规划

| 阶段 | 内容 |
|---|---|
| **V0.1** | agent() + tool() + Agent Loop + 模型层 + 基础 memory |
| **V0.5** | steps 引擎 + rules + 上下文压缩 + wait/resume |
| **V1.0** | team() + plugins + 完整文档 |
