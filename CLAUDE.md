@AGENTS.md

# InterviewAI

AI 模拟面试平台：PDF 简历 → 岗位/题量/难度/轮次/模式配置 → 文字或语音面试 → 逐题评分与报告。

## 必读约束

- 本项目使用 **Next.js 16**。写 Next 相关代码前，先读 `node_modules/next/dist/docs/` 中对应文档，尤其是 Proxy、Route Handlers、App Router 约定。
- 遵守 `AGENTS.md`：不要凭旧版 Next.js 经验改 API 或文件结构。
- 尽量保持改动小而准，避免顺手重构。

## 常用命令

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
```

## 技术栈

Next.js 16.2.6 · React 19 · Tailwind CSS v4 · TypeORM + MySQL · JWT Cookie · LangChain + DeepSeek · DashScope ASR/TTS · antd/@ant-design/x · Recharts · Zod · Vitest

## 关键目录

```text
src/proxy.ts                  # 全局鉴权，写入 x-user-id
src/app/api/**/route.ts       # API Route Handlers
src/app/interview/chat/       # 文字面试
src/app/interview/voice/      # 语音面试
src/app/results/[id]/         # 评分报告
src/entities/                 # TypeORM 实体
src/lib/database.ts           # DataSource 与实体注册
src/lib/deepseek.ts           # Prompt、模型、轮次/评分规则
src/lib/validations.ts        # Zod schema
src/hooks/                    # ASR、TTS、结果轮询
```

## 项目约定

- 认证：`token` HttpOnly Cookie → `src/proxy.ts` 校验 → `x-user-id` → `getUserId(request)`。
- API 错误格式：`{ error: string }` + 合适 HTTP 状态码。
- 输入校验：新增/修改 API 时优先补 `src/lib/validations.ts` 的 Zod schema。
- 数据库：生产环境 `synchronize: false`；新实体必须注册到 `entities[]`。
- 密码策略：≥8 位，数字/小写/大写/符号至少含两种。
- 日志：使用 `logger.info/warn/error`，不要新增 `console.log`。
- 页面渲染：dashboard 和 results 为 `force-dynamic`，避免 build 时触发 DB 连接。
- SSE：`/api/chat` 返回 `{ type: "chunk" | "done" }`。
- PDF：仅支持 PDF，当前解析大小限制 5MB。
- 面试状态：`ongoing`、`evaluating`、`passed`、`done`。

## 环境变量

主要变量见 `.env.example`：数据库、`JWT_SECRET`、`DEEPSEEK_API_KEY`、`DASHSCOPE_API_KEY`、`DASHSCOPE_TTS_VOICE_ID`、`NEXT_PUBLIC_BASE_URL`、`COOKIE_SECURE`、LangSmith 配置。
