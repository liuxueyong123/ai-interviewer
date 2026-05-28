# 评估可靠性改造规格说明

## 背景问题

当前 `POST /api/interviews/[id]/finish` 会先把面试状态设置为 `evaluating`，然后启动一个未等待的后台 Promise 执行评估，接口立即返回。如果 Node 进程重启、请求生命周期提前结束、AI 调用失败或 AI JSON 解析失败，面试可能永久停留在 `evaluating`。

同时，当前评估逻辑直接对 AI 输出执行 `JSON.parse`，没有结构校验和兜底。AI 返回格式稍有偏差，就可能导致整轮评估失败，且用户侧只能看到一直“评估中”。

## 目标

- 避免面试静默卡在 `evaluating`。
- 让评估任务可失败、可重试、可恢复。
- 所有 AI JSON 输出入库前必须经过结构校验。
- 结果页能展示评估失败状态，并提供重试入口。
- 保持现有用户流程：结束面试 → 结果页评估中 → 生成报告或提示重试。

## 非目标

- 本次不引入 Redis、BullMQ 或独立 worker。
- 本次不重写评分 Prompt。
- 本次不重构报告页面布局。
- 本次不处理“提示请求污染题号/评分”的问题。

## 当前风险点

- `src/app/api/interviews/[id]/finish/route.ts` 先写入 `evaluating`，但后续评估不保证完成。
- 评估通过未等待后台 Promise 执行，进程中断会丢任务。
- AI 聚合评估结果直接 `JSON.parse`，缺少 schema 校验。
- catch 里只记录日志，不会把面试状态恢复为失败态。
- 前端只做浏览器侧超时提示，服务端状态依然可能卡住。
- 改为同步 `await` 评估后，finish 接口可能耗时 30-60 秒，客户端默认 fetch 超时（~30s）可能不够。

## 目标行为

### 状态模型

把 `Interview.status` 从：

```ts
"ongoing" | "evaluating" | "passed" | "done"
```

扩展为：

```ts
"ongoing" | "evaluating" | "evaluation_failed" | "passed" | "done"
```

新增评估元数据字段：

- `evaluationStartedAt: Date | null`
- `evaluationFinishedAt: Date | null`
- `evaluationError: string | null`
- `evaluationAttempts: number`

### 结束面试接口

`POST /api/interviews/[id]/finish` 应该：

1. 拒绝已经 `done` 或 `passed` 的面试。
2. 如果当前是 `evaluating` 且没有超时，返回 `{ status: "evaluating" }`。
3. 如果当前是 `evaluation_failed` 或已经超时的 `evaluating`，允许重新评估。
4. 开始评估前写入 `evaluating`，递增 `evaluationAttempts`，清空旧错误。
5. 通过共享评估服务执行当前轮评估。
6. 成功后保存 `Evaluation`，并把面试状态更新为 `passed` 或 `done`。
7. 失败后把面试状态更新为 `evaluation_failed`，保存简短错误信息。

### AI JSON 校验

新增解析模块，负责：

- 从原始 AI 输出中提取 JSON。
- 支持普通 JSON 和 fenced code block。
- 校验逐题评分结果。
- 校验综合评估结果。
- 校验所有分数在 `0..100`。
- 校验 `categories.tech/project/softSkills` 必须存在。
- 校验 `practiceSuggestions` 结构。
- 解析失败时抛出受控错误，而不是裸 `SyntaxError`。

### 结果页行为

当面试状态为 `evaluation_failed`：

- 停止轮询。
- 显示”评估失败”状态和重试按钮，调用 `POST /api/interviews/[id]/finish`。
- 重试按钮点击后应显示 loading 态，防止重复提交。
- 客户端 fetch 应显式设置较长超时（≥120s），适配同步评估的耗时。
- 如果已有前几轮成功评估，仍允许查看已有报告——失败 UI 应为内联提示而非整页替换，保留轮次切换和已有评估展示。

### 全局状态引用审计

`Interview.status` 枚举扩展后，以下位置使用了运行时状态判断，需逐一检查：

- `src/app/dashboard/` — 面试列表的状态展示，`evaluation_failed` 应有区分于 `evaluating` 的视觉表现。
- `src/app/api/interviews/[id]/next-round/route.ts` — `evaluation_failed` 状态下不应允许进入下一轮。
- `src/app/interview/setup/` — 确认是否需要在 `evaluation_failed` 时限制操作。
- 所有 `interview.status === “evaluating”` 的判断点，确认是否需要同时匹配 `evaluation_failed`。

## 验收标准

- AI 聚合评估返回非法 JSON 时，面试不会卡在 `evaluating`。
- 评估过程抛错时，状态会变为 `evaluation_failed`。
- `evaluation_failed` 状态下可以重新评估。
- 当前轮得分未达通过阈值时，状态变为 `done`（即使还有后续轮次）。
- 合法 AI JSON 仍能生成与当前一致的报告数据。
- 结果页遇到 `evaluation_failed` 不会跳回 dashboard。
- 多轮面试中某轮失败，用户仍可切换查看前几轮已完成的报告。
- 测试覆盖 JSON 解析、解析失败、评估失败状态、重试逻辑、未达标结束、多轮评估。
