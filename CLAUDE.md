# InterviewAI

AI 模拟面试练习平台。上传 PDF 简历 → 选择岗位 → AI 面试官提问 → 评分报告。

## 技术栈

Next.js 16 (App Router) · Tailwind CSS v4 · TypeORM + MySQL · JWT 鉴权
DeepSeek API (SSE 流式) · DashScope Qwen3-ASR-Flash (语音转文字)
antd + @ant-design/x · Recharts · Zod 校验

## 项目结构

```
src/
├── proxy.ts                         # 全局鉴权中间件，x-user-id header 透传
├── app/
│   ├── layout.tsx                   # 根布局（ErrorBoundary + AppShell）
│   ├── globals.css                  # 设计 token + 全局样式
│   ├── error.tsx                    # 全局错误边界
│   ├── page.tsx                     # 首页 → redirect /dashboard
│   ├── login/ register/             # 登录注册（密码强度+显示切换）
│   ├── dashboard/                   # 仪表盘（统计卡片+成长轨迹折线图）
│   ├── resumes/                     # 简历管理（上传/编辑/删除）
│   ├── settings/                    # 个人设置（个人信息+修改密码）
│   ├── interview/setup/             # 面试设置（岗位搜索+简历选择+参数）
│   ├── interview/chat/              # 面试对话（语音输入+计时器+提示）
│   ├── results/[id]/                # 面试评分报告（含练习建议）
│   └── api/
│       ├── auth/                    # register/login/logout/password
│       ├── chat/                    # SSE 流式对话
│       ├── speech/                  # Qwen3-ASR-Flash 语音识别
│       ├── users/me/                # 当前用户信息读写
│       ├── interviews/              # 面试 CRUD + finish 评估
│       └── resumes/                 # 简历 CRUD
├── components/
│   ├── ui/                          # Spinner, Icons, ErrorBoundary, Toast
│   ├── layout/                      # NavBar（用户下拉菜单）, AppShell
│   ├── chat/                        # ChatContainer, roleConfig
│   └── interview/                   # SetupForm, ScoreCard, ProgressPanel, RetryButton
├── entities/                        # User Interview Message Evaluation Resume
├── hooks/                           # useSpeechRecognition（MediaRecorder + DashScope）
└── lib/
    ├── database.ts                  # DataSource（connectTimeout: 10s，entity 注册）
    ├── auth.ts                      # bcrypt + JWT
    ├── deepseek.ts                  # Prompt 构建 + AI 评估 + 练习建议
    ├── logger.ts                    # 结构化 JSON 日志
    ├── validations.ts               # Zod schemas + validate helper
    ├── pdf.ts                       # PDFParse
    └── utils.ts                     # getUserId(request)
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
- **输入校验**：所有 API 路由用 Zod schema + `validate()` helper，抛 `ValidationError` 统一处理
- **SSE**：服务端 `ReadableStream` 输出 `{ type: "chunk"|"done" }`，客户端 `EventSourceParserStream` 消费
- **语音识别**：客户端 MediaRecorder 录音 → POST `/api/speech` → DashScope Qwen3-ASR-Flash
- **日志**：`logger.info/warn/error` 结构化 JSON，禁止 `console.log`
- **面试创建**：`POST /api/interviews` 接受 `{ position, resumeId, questionCount, difficulty }`
- **错误格式**：`{ error: string }` + HTTP 状态码
- **数据库**：dev 环境 `synchronize: true`，production 关闭。`DB_SSL=true` 开启 SSL。`connectTimeout` 10s
- **TypeORM**：新实体需在 `lib/database.ts` 的 `entities[]` 注册
- **NavBar**：`/login` `/register` `/interview` 路径下隐藏。右上角用户 dropdown（设置+退出）
- **密码策略**：≥8位，数字/小写/大写/符号至少含两种
- **页面渲染**：dashboard 和 results 设为 `force-dynamic`，避免 build 时触发 DB 连接

## 环境变量

| 变量 | 说明 |
|------|------|
| `DB_HOST/PORT/USER/PASSWORD/NAME` | MySQL 连接 |
| `DB_SSL` | 设为 `true` 开启 SSL |
| `JWT_SECRET` | JWT 签名密钥（生产环境必填） |
| `DEEPSEEK_API_KEY` | DeepSeek API Key |
| `DEEPSEEK_BASE_URL` | DeepSeek API 地址 |
| `DASHSCOPE_API_KEY` | 阿里云百炼 API Key（语音识别） |
| `LANGSMITH_TRACING` | 设为 `true` 开启 LangSmith 追踪 |
| `LANGSMITH_API_KEY` | LangSmith API Key（需在 smith.langchain.com 创建） |
| `LANGSMITH_PROJECT` | LangSmith 项目名 |
| `NEXT_PUBLIC_BASE_URL` | 前端 API 基地址 |
| `COOKIE_SECURE` | Cookie Secure 属性 |
