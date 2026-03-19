# Steps 引擎设计文档

Steps 引擎是 Dao 的核心差异化模块。它将声明式的步骤列表编译为可执行的 Agent 工作流。

---

## 1. 设计目标

- 90% 场景用声明式步骤，10% 复杂场景混入函数
- 步骤列表是人类可读的，不需要画图
- 每种步骤类型行为明确，无歧义

---

## 2. 步骤类型

### 2.1 字符串步骤

```typescript
steps: ["了解项目结构", "逐文件审查", "生成报告"]
```

**引擎行为**：
1. 将字符串作为**子任务指令**注入到当前 Agent 的 prompt 中
2. 调用 Agent Loop 执行该子任务
3. Agent Loop 可能产生多轮工具调用
4. 当 LLM 认为子任务完成时，返回结果
5. 结果存入 `StepContext.lastResult`，进入下一步

**Prompt 注入方式**：
```
你正在执行一个多步骤任务。
当前是第 {n}/{total} 步：{step_text}

请专注完成当前步骤。
```

**完成判断**：每个步骤有独立的 `maxTurns`（默认 10）。引擎通过两种方式判断步骤完成：
1. LLM 返回纯文本且没有工具调用 → 认为完成
2. 达到步骤的 `maxTurns` → 强制结束，收集已有结果

> 不依赖 LLM 输出特殊标记。开源模型的指令遵循能力参差不齐，用 `maxTurns` 兜底更稳定。

### 2.2 并行步骤（parallel）

```typescript
steps: [
  { parallel: ["分析前端代码", "分析后端代码"] },
  // 或包含函数
  { parallel: [
    "分析前端代码",
    () => researcher.run("调研竞品"),
  ]},
]
```

**引擎行为**：
1. 对 `parallel` 数组中的每个元素：
   - 字符串 → 创建独立的 Agent Loop 实例执行
   - 函数 → 直接调用
2. 使用 `Promise.allSettled()` 并行执行所有任务
3. 收集所有结果为数组，存入 `StepContext.lastResult`
4. 任何一个失败不影响其他任务

> **注意**：并行子任务共享同一个 tools 列表，但各自独立执行。如果多个子任务同时操作同一个资源（如写同一个文件），用户需自行保证不冲突。

**并发控制**：
```typescript
// 默认不限制并发数
{ parallel: [...] }

// 限制并发数（后续版本支持）
{ parallel: [...], concurrency: 3 }
```

### 2.3 条件步骤（if/then/else）

```typescript
// 方式一：LLM 判断（字符串条件）
{ if: "发现安全隐患", then: "标记为高优先级", else: "继续下一步" }

// 方式二：代码判断（函数条件）
{ if: (ctx) => ctx.lastResult.hasErrors, then: "修复问题" }

// 方式三：then/else 也可以是复杂步骤
{
  if: "需要重构",
  then: { parallel: ["重构前端", "重构后端"] },
  else: "跳过重构"
}
```

**LLM 判断流程（字符串条件）**：
1. 向模型发送判断请求：
   ```
   基于之前的执行结果，请判断：{condition}
   回答 YES 或 NO，不要解释。
   ```
2. 解析模型回复，提取 YES/NO
3. YES → 执行 `then`，NO → 执行 `else`（如果有）

**代码判断流程（函数条件）**：
1. 调用函数，传入 `StepContext`
2. 返回 truthy → 执行 `then`，falsy → 执行 `else`

### 2.4 重试（retry）

`retry` 是 `ConditionalStep` 的可选属性，不是独立步骤类型：

```typescript
{ if: "测试失败", then: "修复问题", retry: 3 }
```

**引擎行为**：
1. 先执行 `then`
2. 然后评估 `if` 条件
3. 如果条件为 YES（仍然失败），重新执行 `then`
4. 最多重试 `retry` 次
5. 超过重试次数后：记录失败，继续执行后续步骤

### 2.5 等待步骤（wait）— V0.5 计划

> 以下功能计划在 V0.5 实现，V0.1 不包含。

```typescript
{ wait: "请确认是否部署到生产环境" }
```

需要状态序列化和 `resume()` API，复杂度较高，延后实现。

### 2.6 函数步骤

```typescript
steps: [
  "分析需求",
  (ctx) => {
    // 可以访问上一步结果
    console.log("分析结果:", ctx.lastResult)
    // 可以调用其他 Agent
    return writer.run(`写报告: ${ctx.lastResult}`)
  },
  "发布报告",
]
```

**引擎行为**：
1. 直接调用函数，传入 `StepContext`
2. 支持返回 Promise（异步）
3. 返回值存入 `StepContext.lastResult`
4. 如果 throw error，标记步骤失败

---

## 3. 执行流程

```
Engine.run(steps, initialTask)
  │
  ├─ for each step in steps:
  │   │
  │   ├─ step is string?
  │   │   └─ AgentLoop.run(step, context)
  │   │
  │   ├─ step is { parallel }?
  │   │   └─ Promise.allSettled(items.map(execute))
  │   │
  │   ├─ step is { if, then, else?, retry? }?
  │   │   ├─ evaluate condition
  │   │   ├─ execute(then) or execute(else)
  │   │   └─ retry? → do-while loop
  │   │
  │   └─ step is function?
  │       └─ step(context)
  │
  └─ return finalResult
```

---

## 4. 步骤间数据传递

每一步的结果会自动传递给下一步：

```typescript
steps: [
  "分析项目中所有的 TODO 注释",   // → lastResult = "发现 12 个 TODO..."
  "按优先级排序这些 TODO",        // → 能看到上一步的结果
  (ctx) => {
    // ctx.lastResult = 排序后的 TODO 列表
    return ctx.lastResult
  },
  "生成最终报告",                // → 能看到所有之前的结果
]
```

**实现方式**：将 `lastResult` 追加到每一步的 prompt 中：
```
上一步的执行结果：
{lastResult}

当前步骤：{currentStep}
```

---

## 5. 错误处理

| 场景 | 行为 |
|---|---|
| 步骤执行超时 | Grace Period → 强制结束该步骤 → 继续下一步 |
| LLM 返回异常 | 重试 1 次 → 失败则标记步骤失败 → 继续下一步 |
| 工具调用失败 | 将错误信息反馈给 LLM → LLM 决定是否重试 |
| 函数步骤 throw | 标记步骤失败 → 继续下一步 |
| 所有步骤都失败 | RunResult.output 包含错误汇总 |

**设计原则**：默认继续执行，不因单步失败终止整个流程。强依赖场景用 `abort` 显式中止：

```typescript
steps: [
  "创建数据库表",
  (ctx) => { if (!ctx.lastResult.success) ctx.abort("建表失败") },
  "插入初始数据",
  "启动服务",
]
```
