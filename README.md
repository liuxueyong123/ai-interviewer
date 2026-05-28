# InterviewAI

AI 模拟面试练习平台。用户上传 PDF 简历后，可以选择岗位、题量、难度、轮次和面试模式，由 AI 面试官进行文字或语音面试，并在结束后生成逐题评分、综合评估和练习建议。

站点地址：[https://interview.lxycode.cn](https://interview.lxycode.cn)

## 功能概览

- **简历管理**：上传 PDF 简历并自动解析文本，支持查看、编辑文件名与简历内容、删除简历。
- **面试配置**：内置多行业岗位列表，支持岗位搜索、8/12/20/28 题、初级/中级/高级难度、1-3 轮面试。
- **文字面试**：基于 SSE 流式输出 AI 回复，支持语音输入、AI 回复朗读、提示请求、计时和离开确认。
- **语音面试**：视频通话式界面，包含 AI 头像、摄像头预览、字幕、手动录音、语音识别和语音合成。
- **多轮面试**：每轮独立评估；达到当前轮通过阈值后进入 `passed` 状态，用户可手动开始下一轮。
- **评分报告**：逐题评分与点评、综合分、技术基础/项目经验/软技能维度分、优缺点、简历建议、练习建议和轮次总结。
- **成长追踪**：仪表盘展示面试次数、完成次数、平均分、最高分和历史分数折线图。
- **账户设置**：注册登录、JWT Cookie 鉴权、个人信息修改、密码强度校验和密码修改。

## 技术栈

- **Next.js 16.2.6** App Router、Route Handlers、Proxy、standalone 输出
- **React 19.2.4** + **TypeScript 5**
- **Tailwind CSS v4**，设计 token 定义在 `src/app/globals.css`
- **TypeORM 0.3** + **MySQL 8**
- **LangChain** + **DeepSeek API**（`deepseek-v4-pro`，流式面试、逐题评分、综合评估、轮次总结）
- **DashScope**（`qwen3-asr-flash` 语音识别、`qwen-tts-latest` 语音合成）
- **antd 6** + **@ant-design/x**（聊天 UI 与 Markdown 渲染）
- **Recharts**（成长趋势图）
- **pdf-parse** + **@napi-rs/canvas**（PDF 文本解析）
- **Zod**（API 输入校验）
- **bcryptjs** + **jsonwebtoken**（密码哈希与 JWT）
- **Vitest** + **ESLint**

## 本地开发

要求：Node.js 22、pnpm 10、MySQL。

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

开发服务默认运行在 [http://localhost:3000](http://localhost:3000)。

常用命令：

```bash
pnpm dev      # 启动开发服务
pnpm build    # 生产构建
pnpm start    # 启动生产服务
pnpm lint     # ESLint
pnpm test     # Vitest
```

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | MySQL 连接配置，默认库名 `interview_ai` |
| `DB_SSL` | 设为 `true` 时启用 MySQL SSL，`rejectUnauthorized: false` |
| `JWT_SECRET` | JWT 签名密钥；生产环境必须设置 |
| `COOKIE_SECURE` | 登录 Cookie 的 Secure 属性，生产部署通常设为 `true` |
| `DEEPSEEK_API_KEY` | DeepSeek API Key |
| `DEEPSEEK_BASE_URL` | DeepSeek API 地址，默认 `https://api.deepseek.com` |
| `DASHSCOPE_API_KEY` | 阿里云百炼 DashScope API Key，用于 ASR 和 TTS |
| `DASHSCOPE_BASE_URL` | DashScope 地址；ASR 默认兼容模式地址，TTS 默认 `https://dashscope.aliyuncs.com/api/v1` |
| `DASHSCOPE_TTS_VOICE_ID` | DashScope TTS 音色 ID；未配置时 TTS 接口返回错误 |
| `LANGSMITH_TRACING` / `LANGSMITH_API_KEY` / `LANGSMITH_PROJECT` | LangChain 观测性配置 |
| `NEXT_PUBLIC_BASE_URL` | 服务端拉取本站 API 时使用的站点地址，仪表盘 Server Component 会读取 |
| `ACR_REGISTRY` / `ACR_NAMESPACE` | 生产 Docker 镜像地址配置 |

## 项目结构

```text
src/
├── proxy.ts                  # Next 16 Proxy，全局鉴权与 x-user-id 透传
├── app/
│   ├── login/ register/      # 登录、注册
│   ├── dashboard/            # 面试记录、统计和成长趋势
│   ├── resumes/              # PDF 简历上传、解析、编辑、删除
│   ├── settings/             # 个人信息与密码设置
│   ├── interview/setup/      # 面试参数配置
│   ├── interview/chat/       # 文字面试
│   ├── interview/voice/      # 语音面试
│   ├── results/[id]/         # 评分报告、轮次切换、下一轮入口
│   └── api/
│       ├── auth/             # register/login/logout/password
│       ├── chat/             # DeepSeek SSE 流式面试
│       ├── speech/           # DashScope ASR
│       ├── tts/              # DashScope TTS
│       ├── users/me/         # 当前用户信息
│       ├── interviews/       # 面试 CRUD、finish、next-round
│       └── resumes/          # 简历 CRUD
├── components/
│   ├── chat/                 # 文字面试聊天容器
│   ├── interview/            # 面试设置、语音界面、报告组件
│   ├── layout/               # AppShell、NavBar
│   ├── results/              # 评估中状态
│   └── ui/                   # Spinner、Toast、ErrorBoundary、Icons
├── entities/                 # User、Resume、Interview、Message、Evaluation
├── hooks/                    # 录音识别、TTS、结果轮询
└── lib/
    ├── auth.ts               # 密码哈希、JWT 签发与校验
    ├── database.ts           # TypeORM DataSource
    ├── deepseek.ts           # Prompt、模型单例、评分与轮次逻辑
    ├── pdf.ts                # PDF 解析和 5MB 限制
    ├── resultsHelpers.ts     # 结果页步骤与状态文案
    ├── utils.ts              # getUserId 等通用工具
    ├── validations.ts        # Zod schema
    └── logger.ts             # JSON 日志
```

## 核心流程

1. 用户注册或登录后，`src/proxy.ts` 校验 `token` Cookie，并把 `x-user-id` 写入请求头。
2. 用户在简历页上传 PDF，`src/lib/pdf.ts` 解析文本并写入 `resume` 表。
3. 用户在面试设置页选择岗位、简历、题量、轮次、难度和模式，`POST /api/interviews` 创建面试和首条面试官消息。
4. 文字或语音面试调用 `POST /api/chat`，后端按当前轮次加载历史消息，使用 DeepSeek 流式返回下一条问题。
5. 用户结束当前轮后，`POST /api/interviews/[id]/finish` 后台执行逐题评分、综合评估和轮次总结，保存到 `evaluation` 表。
6. 如果当前轮得分达到阈值且还有下一轮，面试状态变为 `passed`；否则变为 `done`。结果页会轮询评估状态，并在通过时显示“进入下一轮”。

## 多轮与评分规则

题量按轮次分配：

| 总题数 | 1 轮 | 2 轮 | 3 轮 |
| --- | --- | --- | --- |
| 8 | 8 | 5 + 3 | 3 + 3 + 2 |
| 12 | 12 | 7 + 5 | 5 + 4 + 3 |
| 20 | 20 | 11 + 9 | 8 + 7 + 5 |
| 28 | 28 | 16 + 12 | 12 + 9 + 7 |

通过阈值由难度和轮次决定：

| 难度 | 第 1 轮 | 第 2 轮 | 第 3 轮 |
| --- | --- | --- | --- |
| 初级 | 50 | 55 | 60 |
| 中级 | 60 | 65 | 70 |
| 高级 | 65 | 70 | 75 |

面试状态：

| 状态 | 含义 |
| --- | --- |
| `ongoing` | 当前轮进行中 |
| `evaluating` | 当前轮评估中 |
| `passed` | 当前轮通过，等待用户启动下一轮 |
| `done` | 面试结束，可能是全部轮次完成或当前轮未通过 |

## 数据库

实体包括：

- `user`：账号、邮箱、密码哈希。
- `resume`：用户上传并解析后的简历文本。
- `interview`：岗位、标题、简历快照、状态、题量、难度、当前轮、最大轮次、模式。
- `message`：面试官与用户消息，记录轮次和题号。
- `evaluation`：每轮评分报告，包含维度分、逐题点评、练习建议和轮次总结。

`src/lib/database.ts` 中 `synchronize` 仅在非生产环境开启：`NODE_ENV=production` 时不会自动同步表结构。生产环境应使用迁移或手动 SQL 管理表结构。

## 部署

项目启用了 Next standalone 输出：

```ts
// next.config.ts
output: "standalone"
```

Dockerfile 使用 Node 22 Alpine 构建，并在运行阶段复制 `.next/standalone`、`.next/static` 和 `public`。生产 compose 文件默认把容器端口绑定到 `127.0.0.1:3000`，适合前面再接反向代理。

```bash
pnpm build
pnpm start
```

或使用 `docker-compose.prod.yml` 部署已构建镜像：

```bash
docker compose -f docker-compose.prod.yml up -d
```

## 相关文档

- [多轮面试功能设计](docs/multi-round-interview.md)
- [时区修复说明](docs/timezone-fix.md)
