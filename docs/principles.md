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

## 已实现的进阶能力

### 1. 容错与自愈（V1.1 ~ V2.0 ✅）

- 模型调用自动重试 — `retry: { maxRetries }` + AI SDK 内置指数退避
- 超时控制 — `timeout` + AbortController + TimeoutError
- Fallback 模型 — `fallbackModel` 主模型失败自动切换
- 错误分类 — ModelError / ToolError / TimeoutError

### 2. 确认机制（V2.0 ✅）

- `tool({ confirm: true })` 标记危险工具
- `agent({ onConfirm })` 回调自定义确认方式（CLI / WebSocket / HTTP 等）

### 3. 输出校验（V1.2 ✅）

- `TaskStep.validate` 代码级校验 + 自动重试
- `TaskStep.output` 输出预期拼入 prompt

---

## 未来演进方向

### 1. 可观测性（V2.1 📋）

- Tracing：每次决策链路追踪
- Token 用量监控
- OpenTelemetry 集成

### 2. 上下文管理（V2.2 📋）

- Token 计数 + 自动截断/摘要（类型已预留 `contextWindow`）
- 成本上限 `maxCostPerRun`

### 3. 安全边界

- Prompt injection 防护
- 工具权限分级
- 敏感信息过滤

### 4. 可测试性（V2.1 📋）

- 模型 Mock（`modelProvider` 已支持注入）
- 响应录制/回放
- 中间步骤断言
