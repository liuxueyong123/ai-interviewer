# 多轮面试功能设计

## 概述

将单轮面试改为支持多轮（一面/二面/三面），每轮独立评估，达到分数阈值才能进入下一轮，否则面试直接结束。

## 题数分配

| 总题数 | 1轮 | 2轮 | 3轮 |
|--------|-----|-----|-----|
| 12 | 12 | 7+5 | 5+4+3 |
| 20 | 20 | 11+9 | 8+7+5 |
| 28 | 28 | 16+12 | 12+9+7 |

`distributeQuestions(total, rounds)` 实现。

## 每轮侧重点

| 轮次 | 3轮模式 | 2轮模式 | 1轮模式 |
|------|---------|---------|---------|
| 一面 | 行业基础 + 简单项目经历 | 行业基础 + 简单项目经历（偏重） | 综合考察 |
| 二面 | 深度项目经历 | 项目经历 + 大局观 + 职业规划 | — |
| 三面 | 项目经历 + 大局观 + 职业规划 | — | — |

`ROUND_FOCUS` 常量定义，`buildInterviewSystemMessage()` 按轮次动态生成 system prompt。

## 状态机

```
                    POST /finish         评估通过 + 有下一轮
ongoing ──────────────────→ evaluating ────────────────────────→ passed
   ↑                           │                                      │
   │          评估未通过 / 最后一轮              用户点击"进入下一轮"   │
   │                           ↓                                      │
   └───────────────────────  done  ←──────────────────────────────────┘
```

- `passed`：当前轮通过，等待用户手动启动下一轮。
- `evaluating`：当前轮评估中。如果前几轮已完成，轮询继续直到当前轮评估结束。

## 通过阈值

`PASS_THRESHOLD` + `getPassThreshold(difficulty, round)`：

| 难度 | 一面 | 二面 | 三面 |
|------|------|------|------|
| junior | 50 | 55 | 60 |
| mid | 60 | 65 | 70 |
| senior | 70 | 75 | 80 |

## 数据模型

### Interview 加字段
- `currentRound` int，默认 1
- `maxRounds` int，默认 2
- `status` 枚举扩展：`"ongoing" | "evaluating" | "passed" | "done"`

### Message 加字段
- `round` int，默认 1

### Evaluation 加字段 + 关系变更
- `round` int
- `roundSummary` text，nullable — AI 生成的轮次对话总结
- Interview ↔ Evaluation：`@OneToOne` → `@OneToMany`

## API

| 端点 | 变更 |
|------|------|
| `POST /api/interviews` | 新增 `maxRounds` 参数（默认2，最大3） |
| `POST /api/chat` | 消息存 `round`；按 `currentRound` 加载历史；`distributeQuestions` 计算每轮题数；多轮时传入 `prevRoundContext`（所有已完成轮次的总结+得分） |
| `POST /api/interviews/[id]/finish` | 仅评估当前轮消息；`Promise.all` 并行调用评分+总结两个 DeepSeek 调用；通过+有下一轮 → `passed`；否则 → `done` |
| `POST /api/interviews/[id]/next-round` | NEW：`currentRound++`，status → `ongoing`，插入轮次首条 AI 消息 |
| `GET /api/interviews/[id]` | 返回 `evaluations[]` + `messages`（含 `round` 字段）+ `currentRound`/`maxRounds` |

### 轮次上下文传递

每轮结束时并行执行两个 DeepSeek 调用：
1. `getEvaluation()` — 评分（temperature=0，懒加载单例）
2. `getRoundSummary()` — 生成 100-200 字对话总结（temperature=0.3，懒加载单例）

两者都成功后保存 Evaluation（含 `roundSummary`），然后更新 Interview 状态。后续轮次的 system prompt 包含所有已完成轮次的总结+得分。

## deepseek.ts 模型管理

三个 lazy singleton 实例，避免每次请求新建 client：

| getter | temp | 用途 |
|--------|------|------|
| `getChatModel()` | 0.7 | 流式对话，thinking: disabled |
| `getEvaluationModel()` | 0 | 评分（需稳定 JSON 输出） |
| `getSummaryModel()` | 0.3 | 轮次总结 |

## 前端

### SetupForm
- 轮数选择（1/2/3，默认2轮）
- 题数改为 12/20/28（原 6/12/20）
- 布局：面试长度+轮次并排，目标难度全宽

### ChatContainer
- 顶部显示 "第 X/Y 轮" 标签（仅多轮时）
- 只展示当前轮次的消息，前轮对话不显示

### Dashboard 面试卡片

完全按 `status` 分流展示：

| status | 展示 |
|--------|------|
| `passed` | 绿色 badge：分数 + "第X/Y轮通过" |
| `done` | 分数数字 + 颜色等级 |
| `evaluating` | 橙色 "评估中" |
| `ongoing` | 蓝色 "第X/Y轮进行中" / "进行中" |

### 结果页（results/[id]）

三种状态：

| 状态 | 展示 |
|------|------|
| 第一轮评估中（无任何评估） | 全屏 spinner + 超时重试 |
| 第N轮评估中（前几轮已完成） | 轮次 Step tabs（已完成✓ + 当前轮 spinner 可点击）+ 可切换查看已完成轮次的详细评分和对话回顾 |
| 当前轮评估完成（passed/done） | 轮次 Step tabs 切换各轮评分（ScoreRing/CategoryBars/优缺点/对话回顾全跟随选中轮次） |

轮询逻辑：仅在当前轮没有评估时才继续轮询。已有评估不会阻断后续轮次的轮询。
