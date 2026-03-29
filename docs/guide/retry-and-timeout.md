# Retry 与 Timeout

框架内置两层容错机制：**模型调用重试** 和 **单次调用超时**，两者互不干扰，可独立使用或组合使用。

## 模型级自动重试 {#retry}

当模型调用失败（网络错误、429 限流、500 错误等），框架自动重试。

```typescript
import { agent } from "dao-ai"

const bot = agent({
  model: "deepseek/deepseek-chat",
  retry: { maxRetries: 3 }, // 默认 2
})
```

**重试策略由 AI SDK 提供：**

- 指数退避：间隔 1s → 2s → 4s
- 429 状态码：自动等待 `Retry-After` header 后重试
- 非幂等错误（405、422 等）：不重试，直接抛出

**常见错误类型：**

| 错误 | 说明 |
|------|------|
| `ModelError` | 模型调用失败（API Key 不对、网络超时、参数错误等） |
| `TimeoutError` | 超时（见下节） |
| `CostLimitError` | 超出 `maxCostPerRun` 上限 |

## 超时控制 {#timeout}

为单次模型调用设置超时，超时后抛出 `TimeoutError`。

```typescript
const bot = agent({
  model: "deepseek/deepseek-chat",
  timeout: 30000, // 毫秒，默认不超时
})
```

```typescript
import { TimeoutError } from "dao-ai"

try {
  await bot.run("生成一份技术方案", { timeout: 10000 })
} catch (e) {
  if (e instanceof TimeoutError) {
    console.log(`超时，耗时 ${e.ms}ms`)
  }
}
```

`TimeoutError` 实例上有 `.ms` 属性，记录实际超时阈值。

## 组合使用 {#combine}

retry 和 timeout 独立工作：**timeout 控制单次调用上限，retry 控制失败后重试总时长**。

```typescript
const bot = agent({
  model: "deepseek/deepseek-chat",
  retry: { maxRetries: 2 },  // 最多 3 次调用
  timeout: 30000,            // 每次调用最多 30 秒
})
```

总耗时上限 ≈ `timeout × (maxRetries + 1)`，即最多 90 秒。

## 与 Fallback Model 配合 {#fallback}

fallback 在 retry 和 timeout 全部失败后触发，fallback 本身也有独立的 retry 和 timeout 控制。

```typescript
const bot = agent({
  model: "deepseek/deepseek-chat",
  fallbackModel: "openai/gpt-4o-mini",
  retry: { maxRetries: 2 },
  timeout: 20000,
})
```

流程：

1. 主模型调用，超时 20s → 重试 2 次（共 3 次）
2. 主模型全部失败 → 切换 fallback 模型
3. fallback 也有自己的 20s 超时和 2 次重试
4. fallback 也失败 → 最终抛出 `ModelError` 或 `TimeoutError`

## 错误分类 {#errors}

所有框架错误均继承自 `DaoError`：

```typescript
import { DaoError, ModelError, ToolError, TimeoutError, CostLimitError } from "dao-ai"

console.log(e instanceof DaoError)        // true（所有框架错误的父类）
console.log(e instanceof TimeoutError)    // true（仅超时）
console.log(e instanceof ModelError)      // true（仅模型错误）
```
