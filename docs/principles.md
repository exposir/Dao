# 设计模式与设计原则

---

## 设计思想

### 1. 大道至简（Less is More）

框架的名字就是核心哲学。把 20 行代码的事变成 5 行，但**不牺牲能力**。用户写的是意图，不是实现。

### 2. 描述式编程（Declarative over Imperative）

用户描述"是什么"，框架处理"怎么做"：

- `role: "代码审查员"` — 描述身份，不是配置参数
- `steps: ["分析", "审查", "总结"]` — 描述步骤，不是写控制流
- `rules: { reject: ["修改代码"] }` — 描述约束，不是写拦截器

### 3. 渐进式复杂度（Progressive Complexity）

复杂度是**线性增长**的，不是断崖式的：

```
chat() → tools → steps → rules → memory → team → plugins
```

每一层只加一两行代码。不需要先学 10 个概念才能开始。

---

## 设计模式

### 1. 工厂函数模式（Factory Function）

所有公开 API 都是工厂函数，不是 class：

```typescript
agent({...})   // 不是 new Agent()
tool({...})    // 不是 new Tool()
plugin({...})  // 不是 new Plugin()
```

**原因**：函数比 class 更轻量、更符合 TS/JS 社区习惯、更容易组合。

### 2. 单对象参数模式（Options Bag）

所有 API 统一传一个对象，不用位置参数：

```typescript
agent({ role, model, tools, steps, rules, memory })
```

**原因**：参数可选、可扩展、自文档化。

### 3. 闭包封装模式（Closure Encapsulation）

`createDelegateTools()` 返回 `{ tools, memberResults }`，内部用闭包共享状态。不暴露内部属性，不用 class 的 private。

### 4. 适配器模式（Adapter）

`resolveModel("deepseek/deepseek-chat")` 把统一的字符串格式适配到不同 provider。用户不需要知道每个 provider 的初始化方式。

### 5. 插件/钩子模式（Plugin/Hook）

核心精简，扩展通过 hooks 生命周期注入：

```
beforeInput → beforeModelCall → afterModelCall → beforeToolCall → afterToolCall → onComplete
```

---

## 设计原则

| 原则 | 体现 |
|---|---|
| **API 望文生义** | `role` / `tools` / `steps` / `rules` — 不用查文档就懂 |
| **约定优于配置** | 不指定 model 时自动检测 .env 里有哪个 key |
| **不造轮子** | 模型层直接用 Vercel AI SDK，不自己封 HTTP |
| **不依赖重型库** | 不用 Zod，参数简写自动转 JSON Schema |
| **软约束优于硬拦截** | `rules.reject` 通过 prompt 注入，信任 LLM |
| **默认继续执行** | 单步失败不终止流程，强依赖用 `abort()` 显式中止 |
| **兜底优于精确控制** | 步骤完成用 `maxTurns` 兜底，不依赖 LLM 输出特殊标记 |

---

## 未来演进方向

> 以下能力将在未来版本逐步引入。

### 1. 可观测性（Observability）

目前只有 `logger()` 插件。生产级 Agent 需要：

- **Tracing**：每次决策链路追踪（哪个步骤、哪个工具、花了多少 token）
- **Token 用量监控**：实时统计各模型的消耗
- **执行时间统计**：识别性能瓶颈

### 2. 容错与自愈（Resilience）

目前只有 `maxTurns` 兜底和 `retry`。生产级 Agent 需要：

- **模型调用自动重试**：带指数退避（exponential backoff）
- **Fallback 模型**：主模型挂了自动切备用（如 DeepSeek → OpenAI）
- **超时控制**：单次模型调用和整体执行的超时

### 3. 上下文管理（Context Management）

`memory: true` 只是内存数组。强大的 Agent 需要：

- **Token 计数**：实时知道上下文还剩多少空间
- **自动截断/摘要**：上下文快满时自动压缩早期对话
- **长期记忆**：跨会话的知识持久化

### 4. 安全边界（Safety Boundary）

`rules.reject` 靠 prompt 注入不够。未来可能需要：

- **工具白名单/黑名单**：硬拦截高危工具调用
- **输出过滤**：检测敏感信息泄露
- **成本上限**：最多花 $X，超了自动停止

### 5. 可测试性（Testability）

Agent 行为难以测试，需要：

- **模型 Mock**：测试时不调用真实 API，用固定响应
- **工具模拟**：mock 文件系统、命令执行等
- **中间步骤断言**：验证 Agent 的决策过程，不只看最终输出
- **快照测试**：prompt 变更后对比行为差异

### 6. 确认机制扩展（Confirm Extensibility）

`tool({ confirm: true })` 目前只适用于 CLI。后端场景需要：

- **`onConfirm` 回调**：在 `AgentOptions` 或 `configure()` 中提供
- **自定义确认方式**：WebSocket 推送、HTTP 回调、消息队列等
