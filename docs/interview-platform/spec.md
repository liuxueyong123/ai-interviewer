# InterviewAI — 面试练习平台设计文档

**日期:** 2026-05-08
**状态:** 已确认

## 一、产品概述

面向程序员的 AI 模拟面试练习平台。用户注册登录后，选择目标岗位、上传 PDF 简历，AI 面试官针对简历和岗位进行专业面试提问，用户逐一回答，最终获得综合评分、维度分析和简历优化建议。

## 二、用户角色

- **求职者（练习者）**：唯一用户角色，平台为练习场景设计

## 三、核心流程

1. **注册/登录** — 账号+邮箱+密码注册，登录后进入 Dashboard
2. **面试设置** — 选择岗位（预设列表）+ 上传 PDF 简历，点击开始
3. **AI 开场** — AI 以面试官身份简短自我介绍，说明规则
4. **面试循环** — AI 提问 → 用户回答 → 下一个问题（约 10-15 轮）
5. **面试结束** — 用户主动点击"结束面试"或问题数达到上限
6. **评分报告** — 综合评分 + 维度分数 + 优势/待改进 + 简历优化建议

## 四、技术栈

| 层级 | 选型 |
|------|------|
| 前端框架 | Next.js 15 App Router + Turbopack |
| 样式 | Tailwind CSS v4 |
| 后端 API | Next.js API Routes |
| 数据库 | MySQL + TypeORM |
| 认证 | JWT + bcrypt，Next.js Middleware |
| AI 模型 | DeepSeek V4 Pro (deepseek-v4-pro) |
| PDF 解析 | pdf-parse (服务端解析) |

## 五、数据模型

### user
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK AUTO_INCREMENT | 主键 |
| username | VARCHAR(50) UNIQUE | 用户名 |
| email | VARCHAR(255) UNIQUE | 邮箱 |
| password_hash | VARCHAR(255) | bcrypt 哈希 |
| created_at | DATETIME | 注册时间 |

### interview
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK AUTO_INCREMENT | 主键 |
| user_id | INT FK → user.id | 所属用户 |
| position | VARCHAR(100) | 目标岗位 |
| resume_text | TEXT | PDF 解析后的纯文本 |
| status | ENUM('ongoing', 'done') | 面试状态 |
| created_at | DATETIME | 创建时间 |

### message
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK AUTO_INCREMENT | 主键 |
| interview_id | INT FK → interview.id | 所属面试 |
| role | ENUM('interviewer', 'user') | 发言角色 |
| content | TEXT | 消息内容 |
| question_number | INT | 问题编号（仅 interviewer 消息） |
| created_at | DATETIME | 发送时间 |

### evaluation
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK AUTO_INCREMENT | 主键 |
| interview_id | INT FK → interview.id | 所属面试（1:1） |
| overall_score | INT | 综合评分 0-100 |
| categories | JSON | 维度分数（技术基础/项目经验/软技能） |
| strengths | TEXT | 优势分析 |
| weaknesses | TEXT | 待改进点 |
| resume_suggestions | TEXT | 简历优化建议 |
| created_at | DATETIME | 生成时间 |

## 六、AI Prompt 设计

### 面试 System Prompt
```
你是 {{position}} 的技术面试官。请严格遵守以下规则：

规则：
1. 每次只提一个问题，等待回答后再提下一个
2. 问题覆盖技术深度、项目经验、行为面试三个维度
3. 根据回答质量动态调整难度
4. 不评价回答，保持中立
5. 共提问约 {{question_count}} 个问题

候选人简历：{{resume_text}}

开始面试：先简短自我介绍，然后提第一个问题。
```

### 问题维度配比
- 技术基础：45%
- 项目经验：45%
- 行为/软技能：10%

### 评分 Prompt（面试结束时调用）
```
请根据以下面试对话，对候选人进行评分。
输出 JSON 格式：
{
  "overallScore": <0-100>,
  "categories": {
    "tech": <0-100>,
    "project": <0-100>,
    "softSkills": <0-100>
  },
  "strengths": "<优点>",
  "weaknesses": "<待改进>",
  "resumeSuggestions": "<简历优化建议>"
}

面试记录：{{conversation_history}}
候选人简历：{{resume_text}}
```

## 七、页面结构

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | Landing | 未登录重定向到 /login |
| `/login` | 登录 | 账号密码登录 |
| `/register` | 注册 | 账号+邮箱+密码注册 |
| `/dashboard` | 历史记录 | 展示所有面试记录列表 |
| `/interview/setup` | 面试设置 | 选择岗位 + 上传 PDF |
| `/interview/chat` | AI 对话 | 核心面试聊天界面 |
| `/results/[id]` | 评分报告 | 评分详情 + 简历建议 |
| `/api/auth/*` | 认证 API | 注册/登录/登出 |
| `/api/chat` | 对话 API | SSE 流式或普通响应 |
| `/api/pdf` | PDF 解析 API | 上传并解析 PDF |
| `/api/interviews` | 面试 CRUD API | 列表/详情/创建/更新 |

## 八、API 设计

### POST /api/auth/register
Body: `{ username, email, password }` → `{ token, user }`

### POST /api/auth/login
Body: `{ username, password }` → `{ token, user }`

### POST /api/pdf
FormData: `{ file: PDF }` → `{ text: "解析后的纯文本" }`

### POST /api/interviews
Body: `{ position, resumeText }` → `{ interviewId }`

### GET /api/interviews
→ `[{ id, position, status, createdAt }]`

### GET /api/interviews/[id]
→ `{ interview, messages, evaluation }`

### POST /api/chat
Body: `{ interviewId, message }` → 流式或同步返回 AI 回复

### POST /api/interviews/[id]/finish
→ 触发评分生成，返回 `{ evaluation }`

## 九、非功能需求

- PDF 大小限制 5MB
- 面试问题数量默认 12 个，可配置
- 密码 bcrypt 加盐哈希
- JWT 过期时间 7 天
- API 单次超时 60s（AI 调用时间）
