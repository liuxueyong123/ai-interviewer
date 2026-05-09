# InterviewAI

AI 模拟面试练习平台。用户上传 PDF 简历，选择岗位，AI 面试官进行专业提问并生成评分报告。

## 技术栈

- **Next.js 16** App Router + Turbopack
- **Tailwind CSS v4**（`@theme inline` 定义设计 token）
- **TypeORM** + MySQL（`synchronize: true`，实体变更自动同步）
- **JWT** 认证（proxy 层统一鉴权，`x-user-id` header 传递给 API）
- **DeepSeek API**（`deepseek-v4-pro`，SSE 流式响应）
- **eventsource-parser**（`EventSourceParserStream` 解析 SSE）
- **pdf-parse v2**（`PDFParse` 类，需配置 worker 路径）
- **antd + @ant-design/x**（Bubble.List + Sender 聊天 UI）

## 项目结构

```
src/
├── proxy.ts                  # 全局鉴权（放行 /login, /register, /api/auth/*）
├── app/api/
│   ├── auth/                 # register/login（Set-Cookie HttpOnly token）
│   ├── chat/                 # SSE 流式聊天
│   ├── interviews/           # CRUD + finish 评估
│   ├── pdf/                  # PDF 解析（5MB 限制）
│   └── resumes/              # 简历 CRUD（GET/POST/PATCH/DELETE）
├── components/
│   ├── ui/                   # Spinner, Icons
│   ├── layout/               # NavBar, AppShell
│   ├── chat/                 # ChatContainer
│   └── interview/            # SetupForm, ScoreCard
├── entities/                 # User, Interview, Message, Evaluation, Resume
└── lib/
    ├── database.ts           # TypeORM DataSource
    ├── auth.ts               # bcrypt + JWT
    ├── deepseek.ts           # Prompt 构建 + getEvaluation
    ├── pdf.ts                # PDFParse（worker 指向 public/pdf.worker.min.mjs）
    └── utils.ts              # getUserId(request)
```

## 设计 Token

全局 CSS 变量，直接作为 Tailwind 类使用：

| Token | 值 | 用途 |
|-------|-----|------|
| `font-display` | Space Grotesk | 标题 |
| `font-sans` | DM Sans | 正文 |
| `surface-0` | #f8fafc | 背景 |
| `surface-1` | #ffffff | 卡片 |
| `accent` | #22c55e | 主色 |
| `text-primary` | #0f172a | 正文色 |
| `border` | #e2e8f0 | 边框 |

用法：`bg-surface-0` `text-accent` `border-border` `font-display`

## 关键约定

- **认证**：proxy.ts → `x-user-id` header → `getUserId(request)` 读取
- **Cookie**：HttpOnly `token`，7 天，SameSite=Lax。API 通过 `Set-Cookie` 设置
- **SSE**：`ReadableStream` `start` + IIFE，输出 `{ type: "chunk"|"done" }`。客户端 `EventSourceParserStream` 消费
- **简历**：管理页自动上传；面试设置页传 `resumeId`，服务端取内容
- **面试创建**：`POST /api/interviews` 接受 `{ position, resumeId }`
- **错误格式**：`{ error: string }` + HTTP 状态码。UI 样式 `bg-red-50 border-red-200 text-red-600`
- **NavBar**：`/login` `/register` `/interview` 路径下隐藏

## 共享组件

- `components/ui/Spinner` — 绿色旋转加载
- `components/ui/Icons` — FileIcon, CheckIcon, UploadIcon, ChevronLeft/RightIcon, ClockIcon
- `lib/utils` — `getUserId(request): number`
- `components/Button` — 通用按钮（loading/disabled）

## 注意事项

- `.env.local` 含 API Key 和数据库密码，勿提交
- `public/pdf.worker.min.mjs` 需手动维护（从 pdfjs-dist 复制）
- 新 TypeORM 实体需在 `lib/database.ts` 的 `entities[]` 注册
- Tailwind v4 使用 `@theme inline`，不使用 v3 的 `tailwind.config`
- `globals.css` 的设计 token 均可作为 Tailwind 类使用
