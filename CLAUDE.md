# InterviewAI

AI 模拟面试练习平台。上传 PDF 简历 → 选择岗位 → AI 面试官提问 → 评分报告。

## 技术栈

Next.js 16 (App Router) · Tailwind CSS v4 · TypeORM + MySQL · JWT 鉴权 · DeepSeek API (SSE 流式) · antd + @ant-design/x

## 项目结构

```
src/
├── proxy.ts                   # 全局鉴权中间件，x-user-id header 透传
├── app/
│   ├── layout.tsx
│   ├── globals.css            # 设计 token + 全局样式
│   ├── page.tsx               # 首页
│   ├── login/ register/       # 登录注册
│   ├── dashboard/             # 仪表盘
│   ├── resumes/               # 简历管理（上传/编辑/删除）
│   ├── interview/setup/       # 面试设置（选择岗位+简历）
│   ├── interview/chat/        # 面试对话（Bubble.List + Sender）
│   ├── results/[id]/          # 面试评分报告
│   └── api/
│       ├── auth/              # register/login/logout
│       ├── chat/              # SSE 流式对话
│       ├── interviews/        # 面试 CRUD + finish 评估
│       └── resumes/           # 简历 CRUD
├── components/
│   ├── ui/Spinner Icons       # 通用 UI
│   ├── layout/NavBar AppShell # 布局
│   ├── chat/ChatContainer ChatHistory roleConfig  # 聊天
│   ├── interview/SetupForm ScoreCard  # 面试
│   └── Button.tsx             # 通用按钮
├── entities/                  # User Interview Message Evaluation Resume
└── lib/
    ├── database.ts            # DataSource（entities 需在此注册）
    ├── auth.ts                # bcrypt + JWT
    ├── deepseek.ts            # Prompt 构建 + AI 评估
    ├── pdf.ts                 # PDFParse（worker: public/pdf.worker.min.mjs）
    └── utils.ts               # getUserId(request)
```

## 设计 Token

| Token | 用途 |
|-------|------|
| `font-display` / `font-sans` | Space Grotesk 标题 / DM Sans 正文 |
| `surface-0`(#f8fafc) / `surface-1`(#fff) / `surface-2`(#f1f5f9) / `surface-3`(#e2e8f0) | 背景层级 |
| `text-primary`(#0f172a) / `text-secondary`(#475569) / `text-muted`(#94a3b8) | 文字层级 |
| `accent`(#22c55e) / `accent-hover`(#16a34a) / `accent-muted`(rgba) | 主色系 |
| `border`(#e2e8f0) / `border-light`(#f1f5f9) | 边框 |
| `danger`(#ef4444) / `danger-muted`(rgba) | 危险/错误 |

用法：`bg-surface-0` `text-accent` `border-border` `font-display`

## 关键约定

- **认证**：proxy.ts 校验 token → `x-user-id` header → `getUserId(request)` 读取。放行 `/login` `/register` `/api/auth/*`
- **Cookie**：HttpOnly `token`，7 天，SameSite=Lax
- **SSE**：服务端 `ReadableStream` 输出 `{ type: "chunk"|"done" }`，客户端 `EventSourceParserStream` 消费
- **面试创建**：`POST /api/interviews` 接受 `{ position, resumeId }`
- **错误格式**：`{ error: string }` + HTTP 状态码
- **数据库**：dev 环境 `synchronize: true` 自动同步，production 关闭。支持 `DB_SSL=true` 开启 SSL
- **TypeORM**：新实体需在 `lib/database.ts` 的 `entities[]` 注册
- **NavBar**：`/login` `/register` `/interview` 路径下隐藏
