# 无简历面试模式设计

**日期：** 2026-06-05
**状态：** 已批准，进入规划阶段

## 目标

允许用户在不选择或上传简历的情况下开始面试。如果用户有简历，设置页仍然默认选中第一份简历，但再次点击已选中的简历会取消选择并进入无简历面试。

## 范围

本功能包含：

- 移除面试设置页对已选简历的硬性要求。
- 有保存简历时，默认选中第一份。
- 再次点击已选中的简历卡片可取消选择。
- 无简历选择时，以空 `resumeText` 创建面试。
- 当 `resumeText.trim()` 为空时，适配面试提示词。
- 无简历面试中隐藏简历建议 UI。
- 文字面试、语音面试、题量、轮次、难度等行为保持不变。

本功能不包含：

- 新增数据库字段（如 `contextMode`）。
- 专用的无简历面试 API。
- 手动填写背景信息（技能、工作年限、项目摘要等）。
- “求职意向表达建议”替代板块。
- 数据库迁移。

## 当前系统上下文

当前面试设置流程以简历为先：

- `src/components/interview/SetupForm.tsx` 从 `GET /api/resumes` 加载已保存的简历。
- 如果恰好有一份简历，设置表单当前会选中它。
- `handleStart()` 当前在 `selectedResumeId` 为空时阻止开始。
- 开始按钮在 `position` 和 `selectedResumeId` 同时存在时才可点击。
- `POST /api/interviews` 接受 `resumeText` 和 `resumeId`，但当最终简历文本为空时返回 `400`。
- `Interview.resumeText` 是非空 `text` 列，因此空字符串是表示无简历面试最简单、无需迁移的方式。
- `buildInterviewSystemMessage()` 始终包含“候选人简历”章节。
- 评估聚合始终要求模型输出 `resumeSuggestions`。

## 产品行为

### 设置页

设置页保持统一的流程。

有已保存简历时：

- 默认选中第一份简历。
- 简历卡片可被选中。
- 如果用户点击未被选中的简历，则选中它。
- 如果用户点击已选中的简历，则取消选择。
- 未选择简历时，页面提示将进行无简历面试。

无已保存简历时：

- 不阻止开始面试。
- 显示轻量空状态，说明上传简历是可选的。
- 保留指向 `/resumes` 的链接，供希望基于简历提问的用户使用。

“开始面试”按钮只需选择目标岗位，不强制要求简历。

### 面试创建 API

`POST /api/interviews` 继续使用现有请求结构：

```json
{
  "position": "前端开发工程师",
  "questionCount": 12,
  "maxRounds": 2,
  "difficulty": "mid",
  "mode": "text",
  "resumeId": 1
}
```

无简历面试时，客户端省略 `resumeId`：

```json
{
  "position": "前端开发工程师",
  "questionCount": 12,
  "maxRounds": 2,
  "difficulty": "mid",
  "mode": "text"
}
```

服务端行为：

- 如果 `resumeId` 存在，加载简历并使用其 `content`。
- 如果 `resumeId` 不存在且 `resumeText` 不存在或为空，以 `resumeText: ""` 创建面试。
- 保留对 `resumeId` 的所有权检查。
- 保持 `prevInterviewId` 行为不变。重新开始的面试应继承之前面试的 `resumeText`，包括空字符串。

### 开场消息

有简历面试保持当前开场风格。

无简历面试中，第一条面试官消息不应暗示提供了简历：

```text
同学你好，很高兴见到你。我是今天{{position}}岗位的面试官。我们会围绕岗位能力、项目经历和综合素质进行交流。请先简单介绍一下自己，以及你和这个岗位相关的经历。
```

### 面试提示词

`buildInterviewSystemMessage()` 使用 `resumeText.trim()` 进行分支。

有简历文本时：

- 保持现有基于简历的提示词。
- 包含“候选人简历”章节。
- 要求面试官结合简历细节和目标岗位提问。

无简历文本时：

- 不包含“候选人简历”章节。
- 告知面试官候选人未提供简历。
- 要求面试官通过候选人的自我介绍和回答建立背景。
- 问题应覆盖岗位基础、场景判断、项目经历、沟通表达和问题解决能力。
- 面试官不应说“根据你的简历”或引用不存在的简历细节。

已有的语音模式规则仍然适用：语音提示词返回纯文本，不含 Markdown。

### 评估

逐题评分保持不变。

聚合评估应根据 `resumeText.trim()` 分支：

有简历文本时，保持当前输出契约：

```json
{
  "overallScore": 80,
  "categories": {
    "tech": 80,
    "project": 75,
    "softSkills": 85
  },
  "strengths": "string",
  "weaknesses": "string",
  "resumeSuggestions": "string",
  "practiceSuggestions": []
}
```

无简历文本时，不要求模型输出 `resumeSuggestions`：

```json
{
  "overallScore": 80,
  "categories": {
    "tech": 80,
    "project": 75,
    "softSkills": 85
  },
  "strengths": "string",
  "weaknesses": "string",
  "practiceSuggestions": []
}
```

API 可以为无简历面试存储 `resumeSuggestions: ""` 以保持现有数据库结构。

### 结果 UI

结果页应在无简历时隐藏简历建议板块。

判断条件应基于 `GET /api/interviews/[id]` 已返回的面试数据：

- 如果 `interview.resumeText.trim()` 有内容，显示当前简历建议板块。
- 如果 `interview.resumeText.trim()` 为空，完全隐藏该板块。

不添加替代板块。

## 架构

本设计将无简历面试视为简历内容的缺失，而非一种独立的面试类型。边界有意保持最小：

- UI 控制 `resumeId` 是否存在。
- API 在无简历选择时持久化空 `resumeText`。
- 提示词和评估辅助函数从 `resumeText.trim()` 分支。
- 结果 UI 在 `resumeText` 为空时隐藏仅简历相关内容。

这避免了数据库迁移，并保持所有现有的模式、轮次、评分和仪表盘行为不变。

## 数据模型

无 schema 变更。

现有 `Interview.resumeText` 保持 `text` 类型，存储：

- 有简历面试：解析后的简历内容。
- 无简历面试：空字符串。

## 需要修改的文件

- `src/components/interview/SetupForm.tsx`
  - 有简历时默认选中第一份。
  - 再次点击已选中简历时取消选择。
  - 从校验和按钮禁用状态中移除简历要求。
  - 仅在有选中简历时发送 `resumeId`。
  - 调整空状态文案，说明简历为可选项。

- `src/app/api/interviews/route.ts`
  - 允许空的 `finalResumeText`。
  - 以 `resumeText: finalResumeText` 创建面试。
  - 当 `finalResumeText.trim()` 为空时使用无简历开场消息。

- `src/lib/deepseek.ts`
  - `buildInterviewSystemMessage()` 按 `resumeText.trim()` 分支。
  - `buildAggregationMessage()` 按 `resumeText.trim()` 分支。
  - 确保无简历提示词不提及不存在的简历内容。

- `src/app/results/[id]/page.tsx`
  - 从面试数据推导是否包含简历内容。
  - 将该状态传入评估文本组件，覆盖已完成和部分完成的结果视图。

- `src/components/interview/EvaluationText.tsx`
  - 新增 `showResumeSuggestions` 布尔 prop。
  - 当 `showResumeSuggestions` 为 false 时隐藏简历建议块。
  - 为有简历面试保留当前“简历优化建议”块。

- `src/components/interview/ScoreCard.tsx`
  - 传入 `showResumeSuggestions={true}` 以保持现有包装器的简历行为。

- 现有 Vitest 结构中的测试
  - 新增设置表单测试：默认选择、取消选择、无简历开始。
  - 新增面试创建 API 测试：省略 `resumeId`。
  - 新增提示词/评估辅助函数测试：无简历分支。
  - 新增结果页测试或聚焦组件覆盖：隐藏简历建议。

## 错误处理

- 缺少岗位仍返回现有“请选择目标岗位”校验错误。
- 无效或未授权的 `resumeId` 仍返回“简历不存在”。
- 未选择简历不是错误。
- 空 `resumeText` 仅作为无简历内容被允许；空白的用户提供简历文本不应在本功能中作为独立 UI 路径处理。

## 测试计划

单元和集成测试应覆盖：

- 设置表单在有简历时默认选中第一份保存的简历。
- 再次点击已选中的简历清除选择。
- 有岗位且未选择简历时，开始按钮可点击。
- 设置表单在未选择简历时不发送 `resumeId`。
- `POST /api/interviews` 在省略 `resumeId` 时以 `resumeText: ""` 创建面试。
- `POST /api/interviews` 仍拒绝不存在或未授权的 `resumeId`。
- 无简历系统提示词省略“候选人简历”章节。
- 无简历系统提示词要求面试官通过自我介绍和回答建立背景。
- 无简历聚合提示词省略 `resumeSuggestions`。
- 有简历聚合提示词仍包含 `resumeSuggestions`。
- 结果 UI 在 `resumeText` 为空时隐藏简历建议。
- 现有基于简历的设置和面试创建行为仍然正常。

验证命令：

```bash
pnpm test
pnpm lint
pnpm build
```

## 验收标准

- 用户可以仅选择目标岗位后开始面试。
- 如果存在简历，默认选中第一份。
- 再次点击已选中的简历可取消选择。
- 无简历面试在文字和语音模式下均可正常工作。
- 无简历提示词不引用提供的简历。
- 有简历面试保持当前行为。
- 无简历结果报告不显示简历建议或替代建议板块。
- 此变更不需要数据库迁移。
