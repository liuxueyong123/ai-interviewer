# 评估可靠性改造实施计划

> **给 agentic workers：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务执行。本计划使用 checkbox (`- [ ]`) 跟踪进度。

**目标：** 让面试评估具备失败态、重试能力和 AI JSON 校验，避免面试永久卡在 `evaluating`。

**架构：** 将评估流程从 route 中抽到 `evaluationService`，用 `evaluation_failed` 表示可恢复失败态，并用 Zod 校验 AI 输出后再入库。Route 只负责状态判断和触发评估，结果页负责展示评估中、失败、成功三类状态。

**技术栈：** Next.js 16 Route Handlers、TypeORM、MySQL、Zod、Vitest、LangChain DeepSeek。

**测试策略：** `evaluationParsers` 纯单测，无外部依赖。`evaluationService` 需 mock TypeORM DataSource（参考现有 `src/lib/__tests__/` 下的 mock 方式），核心验证状态转换和评估编排逻辑。

---

## 文件规划

- 修改：`src/entities/Interview.ts`
  - 扩展状态枚举，新增评估元数据字段。

- 新增：`src/lib/evaluationParsers.ts`
  - 负责 AI JSON 提取、Zod 校验、类型化返回。

- 新增：`src/lib/evaluationService.ts`
  - 负责当前轮评估编排、状态更新、失败恢复。

- 修改：`src/app/api/interviews/[id]/finish/route.ts`
  - 移除未追踪后台 Promise，改为调用评估服务。

- 修改：`src/hooks/useResultsPolling.ts`
  - 支持 `evaluation_failed`，失败时停止轮询。

- 修改：`src/app/results/[id]/page.tsx`
  - 增加评估失败 UI 和重试入口。

- 新增测试：
  - `src/lib/__tests__/evaluationParsers.test.ts`
  - `src/lib/__tests__/evaluationService.test.ts`

---

## 任务 1：扩展 Interview 状态模型

**文件：**

- 修改：`src/entities/Interview.ts`

- [ ] 步骤 1：扩展 `status` enum。

```ts
@Column({
  type: "enum",
  enum: ["ongoing", "evaluating", "evaluation_failed", "passed", "done"],
  default: "ongoing",
})
status: "ongoing" | "evaluating" | "evaluation_failed" | "passed" | "done";
```

- [ ] 步骤 2：新增评估元数据字段。

```ts
@Column({ type: "datetime", name: "evaluation_started_at", nullable: true })
evaluationStartedAt: Date | null;

@Column({ type: "datetime", name: "evaluation_finished_at", nullable: true })
evaluationFinishedAt: Date | null;

@Column({ type: "text", name: "evaluation_error", nullable: true })
evaluationError: string | null;

@Column({ type: "int", name: "evaluation_attempts", default: 0 })
evaluationAttempts: number;
```

- [ ] 步骤 3：执行构建检查。

```bash
pnpm build
```

预期：如果其他地方有状态类型假设，构建会暴露出来；后续任务一起修复。

---

## 任务 2：新增 AI 评估结果解析器

**文件：**

- 新增：`src/lib/evaluationParsers.ts`
- 新增：`src/lib/__tests__/evaluationParsers.test.ts`

- [ ] 步骤 1：先写失败测试。

测试场景：

- 能解析普通 JSON 综合评估。
- 能解析 fenced code block。
- 非法 JSON 会失败。
- 缺少 `categories` 会失败。
- 分数超出 `0..100` 会失败。
- 能解析逐题评分 `{ score, comment }`。
- `practiceSuggestions` 结构错误会失败。

执行：

```bash
pnpm test src/lib/__tests__/evaluationParsers.test.ts
```

预期：失败，因为模块尚不存在。

- [ ] 步骤 2：实现 `src/lib/evaluationParsers.ts`。

必须导出：

```ts
export class EvaluationParseError extends Error {}

export interface ParsedQuestionEvaluation {
  score: number;
  comment: string;
}

export interface ParsedAggregateEvaluation {
  overallScore: number;
  categories: {
    tech: number;
    project: number;
    softSkills: number;
  };
  strengths: string;
  weaknesses: string;
  resumeSuggestions: string;
  practiceSuggestions: Array<{
    area: string;
    description: string;
    suggestion: string;
  }> | null;
}

export function extractJsonObject(raw: string): string;
export function parseQuestionEvaluation(raw: string): ParsedQuestionEvaluation;
export function parseAggregateEvaluation(raw: string): ParsedAggregateEvaluation;
```

实现要求：

- 使用 Zod。
- 使用严格对象 schema。
- `extractJsonObject` 优先读取 fenced JSON，其次读取第一个 `{...}` 块。
- 失败时抛出 `EvaluationParseError`，错误信息保持简短安全。

- [ ] 步骤 3：运行解析器测试。

```bash
pnpm test src/lib/__tests__/evaluationParsers.test.ts
```

预期：通过。

---

## 任务 3：抽取评估服务

**文件：**

- 新增：`src/lib/evaluationService.ts`
- 新增：`src/lib/__tests__/evaluationService.test.ts`
- 修改：`src/app/api/interviews/[id]/finish/route.ts`

- [ ] 步骤 1：先写服务测试。

测试场景：

- 当前轮评估成功后保存 `Evaluation`。
- 分数达标且还有下一轮时，状态变为 `passed`。
- 最后一轮评估完成后，状态变为 `done`。
- 分数未达标时，状态变为 `done`（即使还有后续轮次）。
- 聚合评估 JSON 解析失败时，状态变为 `evaluation_failed`。
- 模型调用抛错时，状态变为 `evaluation_failed`。
- 重试时会删除当前轮旧评估。
- 失败时 `evaluationError` 非空。
- 每次重试会递增 `evaluationAttempts`。

执行：

```bash
pnpm test src/lib/__tests__/evaluationService.test.ts
```

预期：失败，因为服务尚不存在。

- [ ] 步骤 2：实现 `runRoundEvaluation`。

`src/lib/evaluationService.ts` 导出：

```ts
export interface RunRoundEvaluationOptions {
  interviewId: number;
  userId: number;
}

export interface RunRoundEvaluationResult {
  status: "passed" | "done";
  evaluationId: number;
  round: number;
}

export async function runRoundEvaluation(
  options: RunRoundEvaluationOptions,
): Promise<RunRoundEvaluationResult>;
```

职责：

- 按 `interviewId` 和 `userId` 加载面试及消息。
- 只评估当前轮。
- 保存新评估前删除当前轮旧评估。
- 提取 QA 对。
- 调用现有 DeepSeek prompt builder。
- 用 `parseQuestionEvaluation` 解析逐题评分。
- 用 `parseAggregateEvaluation` 解析综合评估。
- 保存 `Evaluation`。
- 用 `getPassThreshold` 计算通过状态。
- 成功时更新为 `passed` 或 `done`。
- 成功时写入 `evaluationFinishedAt`。
- 任意失败时更新为 `evaluation_failed`，写入 `evaluationError` 和 `evaluationFinishedAt`，记录日志并抛出受控错误。

- [ ] 步骤 3：迁移 route 内部 helper。

从 `finish/route.ts` 移到 `evaluationService.ts`：

- `extractQAPairs`
- `buildConversationHistory`
- `evaluateSingleQuestion`
- `evaluateAllQuestions`

默认不导出这些 helper，优先通过 `runRoundEvaluation` 测试整体行为。

- [ ] 步骤 4：运行服务测试。

```bash
pnpm test src/lib/__tests__/evaluationService.test.ts
```

预期：通过。

---

## 任务 4：改造 finish route 为可重试入口

**文件：**

- 修改：`src/app/api/interviews/[id]/finish/route.ts`

- [ ] 步骤 1：替换未等待后台 Promise。

逻辑改为：

```ts
if (!interview) return 404;
if (interview.status === "done" || interview.status === "passed") return 400;

if (interview.status === "evaluating" && !isEvaluationStale(interview)) {
  return NextResponse.json({ status: "evaluating" });
}
```

- [ ] 步骤 2：新增评估超时判断。

在 `src/lib/evaluationService.ts` 中导出：

```ts
export const EVALUATION_STALE_MS = 10 * 60 * 1000;

export function isEvaluationStale(interview: Interview): boolean;
```

返回 true 的条件：

- 状态是 `evaluating`；
- 且 `evaluationStartedAt` 不存在；
- 或当前时间距离 `evaluationStartedAt` 超过 10 分钟。

- [ ] 步骤 3：触发评估前标记尝试。

更新字段：

```ts
{
  status: "evaluating",
  evaluationStartedAt: new Date(),
  evaluationFinishedAt: null,
  evaluationError: null,
  evaluationAttempts: previousAttempts + 1
}
```

- [ ] 步骤 4：调用 `runRoundEvaluation`。

本次推荐直接 `await runRoundEvaluation(...)`，避免未追踪后台任务。

成功返回：

```json
{ "status": "passed" }
```

或：

```json
{ "status": "done" }
```

失败返回：

```json
{ "status": "evaluation_failed", "error": "评估失败，请重试" }
```

HTTP 状态码使用 `500`。

- [ ] 步骤 5：运行测试和构建。

```bash
pnpm test src/lib/__tests__/evaluationParsers.test.ts src/lib/__tests__/evaluationService.test.ts
pnpm build
```

预期：通过。

---

## 任务 5：结果页支持评估失败状态

**文件：**

- 修改：`src/hooks/useResultsPolling.ts`
- 修改：`src/app/results/[id]/page.tsx`

- [ ] 步骤 1：扩展前端状态类型。

```ts
status: "ongoing" | "evaluating" | "evaluation_failed" | "passed" | "done";
evaluationError?: string | null;
evaluationAttempts?: number;
```

- [ ] 步骤 2：失败状态停止轮询。

在 `fetchData` 里，`setData(json)` 后增加：

```ts
if (json.interview.status === "evaluation_failed") {
  setTimedOut(false);
  return;
}
```

- [ ] 步骤 3：保留重试逻辑，增加客户端超时和 loading 态。

`handleRetry` 调用 `POST /api/interviews/${id}/finish`，需要：

- 设置 fetch 超时为 120s（`AbortController` + `setTimeout`），避免默认 ~30s 超时先于服务端返回。
- 重试期间按钮进入 loading 态，防止重复提交。

```ts
const handleRetry = async () => {
  setIsRetrying(true);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);
    const res = await fetch(`/api/interviews/${id}/finish`, {
      method: "POST",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      startTimeRef.current = Date.now();
      fetchData(); // 重新开始轮询
    }
  } finally {
    setIsRetrying(false);
  }
};
```

- [ ] 步骤 4：结果页新增失败分支，保留已有报告可见。

失败 UI 应为**内联提示**而非整页替换。当 `evaluation_failed` 时：

- 如果当前轮已有前几轮的成功评估，保留轮次切换和已有报告内容。
- 在当前轮区域显示失败提示卡片 + 重试按钮。
- 仅当尚无任何成功评估（如首轮即失败）时才显示整页失败 UI。

```tsx
// 整页失败（无任何成功评估时）
if (interview.status === "evaluation_failed" && !hasAnyEvaluation) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md space-y-4">
        <h1 className="font-display text-xl font-bold text-text-primary">
          评估失败
        </h1>
        <p className="text-text-muted text-sm">
          AI 评估未能完成，请重新评估当前轮。
        </p>
        {interview.evaluationError && (
          <p className="text-danger text-xs">{interview.evaluationError}</p>
        )}
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="px-4 py-2 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover active:scale-[0.98] transition-all duration-200 font-display text-sm disabled:opacity-50"
        >
          {isRetrying ? "评估中..." : "重新评估"}
        </button>
      </div>
    </div>
  );
}

// 内联失败提示（已有前几轮报告时）
if (interview.status === "evaluation_failed" && hasAnyEvaluation) {
  return (
    <>
      {/* 保留现有轮次切换和报告展示 */}
      {existingReportUI}
      {/* 当前轮位置插入失败提示 */}
      <div className="mt-6 p-4 border border-danger/30 rounded-xl bg-danger/5 text-center">
        <p className="text-danger text-sm font-semibold">当前轮评估失败</p>
        {interview.evaluationError && (
          <p className="text-text-muted text-xs mt-1">{interview.evaluationError}</p>
        )}
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="mt-3 px-4 py-2 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover active:scale-[0.98] transition-all duration-200 font-display text-sm disabled:opacity-50"
        >
          {isRetrying ? "评估中..." : "重新评估"}
        </button>
      </div>
    </>
  );
}
```

- [ ] 步骤 5：运行构建。

```bash
pnpm build
```

预期：通过。

---

## 任务 6：全局状态引用审计

**文件：**

- 检查：`src/app/dashboard/page.tsx`
- 检查：`src/app/api/interviews/[id]/next-round/route.ts`
- 检查：`src/app/interview/setup/page.tsx`
- 检查：所有引用 `interview.status` 的文件

- [ ] 步骤 1：对 `evaluation_failed` 做差异化展示。

控制面板的面试列表中，`evaluation_failed` 应有独立的状态文案和视觉样式，不应与 `evaluating` 共用 spinner。

- [ ] 步骤 2：next-round 路由增加状态守卫。

```ts
if (interview.status === "evaluation_failed") {
  return NextResponse.json(
    { error: "当前轮评估失败，请先重试评估" },
    { status: 400 },
  );
}
```

- [ ] 步骤 3：运行 grep 审计所有 status 引用。

```bash
grep -rn "status === " src/app/ src/components/ src/hooks/ | grep -v node_modules
grep -rn "\.status" src/app/ src/components/ src/hooks/ | grep -v node_modules
```

确认每个判断点都正确处理了 `evaluation_failed`。

- [ ] 步骤 4：运行构建。

```bash
pnpm build
```

预期：通过。

---

## 任务 7：最终验证

- [ ] 步骤 1：运行完整测试。

```bash
pnpm test
```

预期：通过。

- [ ] 步骤 2：运行 lint。

```bash
pnpm lint
```

预期：通过。

- [ ] 步骤 3：运行生产构建。

```bash
pnpm build
```

预期：通过。

- [ ] 步骤 4：手动验证。

启动：

```bash
pnpm dev
```

验证场景：

1. 正常完成一次面试，确认报告生成。
2. 模拟聚合评估返回非法 JSON，确认状态变为 `evaluation_failed`。
3. 点击重新评估，确认状态从 `evaluation_failed` 回到 `evaluating`，最后变为 `done` 或 `passed`。
4. 在失败状态刷新结果页，确认不会跳回 dashboard。
5. 在评估中刷新结果页，确认仍继续轮询。

---

## 自检

规格覆盖情况：

- 风险 1：通过 `evaluation_failed`、评估元数据、超时重试、移除未追踪后台 Promise 覆盖。
- 风险 2：通过 `evaluationParsers.ts`、Zod 校验、受控解析错误、失败状态更新覆盖。
- 前端恢复路径：通过结果页失败状态（整页 + 内联两种）、重试按钮、loading 态、120s 超时覆盖。
- 多轮已有报告可见：通过内联失败提示 + 保留轮次切换覆盖。
- 全局状态一致性：通过状态引用审计任务覆盖。
- 未达标结束：通过 `evaluationService` 测试场景覆盖。
- 客户端超时：通过显式 `AbortController` 120s 超时覆盖。
