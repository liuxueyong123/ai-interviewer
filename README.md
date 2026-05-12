# InterviewAI

AI 模拟面试练习平台。上传 PDF 简历 → 选择岗位 → AI 面试官提问 → 评分报告。

站点地址：[https://interview.lxycode.cn](https://interview.lxycode.cn)

## 功能

- **AI 模拟面试**：选择岗位和难度，AI 面试官进行专业提问（支持语音输入和文字提示）
- **智能评分**：AI 从技术基础、项目经验、软技能三个维度评分，逐题点评
- **练习建议**：AI 分析薄弱环节，给出针对性练习方案
- **成长追踪**：跨多次面试的能力分数变化折线图
- **简历管理**：上传 PDF 简历，自动解析内容作为面试上下文
- **个人设置**：修改个人信息和密码（强度校验）

## 技术栈

- **Next.js 16** App Router + Turbopack
- **Tailwind CSS v4**（`@theme inline` 定义设计 token）
- **TypeORM** + MySQL（`synchronize: true`，实体变更自动同步；`connectTimeout` 10s）
- **JWT** 认证（proxy 层统一鉴权，`x-user-id` header 传递给 API）
- **DeepSeek API**（`deepseek-v4-pro`，SSE 流式对话）
- **DashScope Qwen3-ASR-Flash**（语音转文字，OpenAI 兼容接口）
- **Zod**（全部 API 输入校验）
- **Recharts**（成长轨迹折线图）
- **antd + @ant-design/x**（Bubble.List + Sender 聊天 UI）
- **eventsource-parser**（SSE 流解析）
- **bcryptjs + jsonwebtoken**（密码哈希 + JWT）

## 本地开发

```bash
pnpm install
cp .env.example .env.local   # 编辑填入数据库和 API Key
pnpm dev                      # http://localhost:3000
```

## 项目结构

```
src/
├── proxy.ts                  # 全局鉴权（放行 /login, /register, /api/auth/*）
├── app/
│   ├── error.tsx             # 全局错误边界
│   ├── login/ register/      # 登录注册（密码强度+显示隐藏）
│   ├── dashboard/            # 仪表盘（统计+成长轨迹图）+ loading.tsx
│   ├── resumes/              # 简历管理（上传/编辑/删除）
│   ├── settings/             # 个人设置（信息修改+密码修改）
│   ├── interview/setup/      # 面试设置（岗位搜索+简历选择）
│   ├── interview/chat/       # 面试对话（语音输入+计时器+离开提醒）
│   ├── results/[id]/         # 评分报告（分数环+分类条+逐题回顾+练习建议）
│   └── api/
│       ├── auth/             # register/login/logout/password
│       ├── chat/             # SSE 流式聊天
│       ├── speech/           # 语音识别（Qwen3-ASR-Flash）
│       ├── users/me/         # 用户信息 GET/PATCH
│       ├── interviews/       # CRUD + finish 评估
│       └── resumes/          # 简历 CRUD
├── components/
│   ├── ui/                   # Spinner, Icons, ErrorBoundary, Toast
│   ├── layout/               # NavBar（用户下拉菜单）, AppShell
│   ├── chat/                 # ChatContainer（面试主界面）
│   └── interview/            # SetupForm, ScoreCard, ProgressPanel, RetryButton
├── entities/                 # User, Interview, Message, Evaluation, Resume
├── hooks/                    # useSpeechRecognition（MediaRecorder 录音）
└── lib/
    ├── database.ts           # TypeORM DataSource
    ├── auth.ts               # bcrypt + JWT
    ├── deepseek.ts           # Prompt 构建 + 评估 + 练习建议
    ├── validations.ts        # Zod schemas + validate()
    ├── logger.ts             # 结构化 JSON 日志
    ├── pdf.ts                # PDF 解析
    └── utils.ts              # getUserId(request)
```

## 设计 Token

| Token          | 值            | 用途   |
| -------------- | ------------- | ------ |
| `font-display` | Space Grotesk | 标题   |
| `font-sans`    | DM Sans       | 正文   |
| `surface-0`    | #f8fafc       | 背景   |
| `surface-1`    | #ffffff       | 卡片   |
| `accent`       | #22c55e       | 主色   |
| `text-primary` | #0f172a       | 正文色 |
| `border`       | #e2e8f0       | 边框   |

## 环境变量

| 变量 | 说明 |
|------|------|
| `DB_HOST/PORT/USER/PASSWORD/NAME` | MySQL 连接 |
| `DB_SSL` | 设为 `true` 开启 SSL |
| `JWT_SECRET` | JWT 签名密钥 |
| `DEEPSEEK_API_KEY` | DeepSeek API Key |
| `DASHSCOPE_API_KEY` | 阿里云百炼 API Key（语音识别） |
| `NEXT_PUBLIC_BASE_URL` | 站点地址 |
| `COOKIE_SECURE` | Cookie Secure 属性 |

## 数据库变更

执行过的 SQL（`synchronize: true` 自动同步，以下仅记录）：

```sql
ALTER TABLE evaluation ADD COLUMN practice_suggestions JSON NULL AFTER question_reviews;
```
