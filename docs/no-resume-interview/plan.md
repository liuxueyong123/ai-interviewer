# 无简历面试模式实施计划

> **面向执行者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 按任务逐个实施。步骤使用 checkbox（`- [ ]`）语法进行跟踪。

**目标：** 允许用户在不选择简历的情况下开始文字或语音面试，同时在已选简历时保持基于简历的行为。

**架构：** 将无简历面试视为 `resumeText` 为空字符串的现有 `Interview` 记录。保持现有设置页和面试 API，从 `resumeText.trim()` 分支提示词和结果渲染，为无简历评估存储空的 `resumeSuggestions` 值。

**技术栈：** Next.js 16.2.6 App Router Route Handlers、React 19 Client Components、TypeScript、TypeORM、LangChain message helpers、Vitest、Testing Library、happy-dom。

---

## 范围检查

批准的 spec 覆盖一个功能路径：将无简历面试作为简历内容的缺失。不引入新的数据库模式、新 API、迁移、背景资料表单或替代建议板块。这足够小，适合单个实施计划。

## 文件结构

- 新建 `src/components/interview/__tests__/SetupForm.noResume.test.tsx`
  - 测试默认简历选择、取消选择、无简历请求载荷、以及空简历列表时的无简历开始。
- 修改 `src/components/interview/SetupForm.tsx`
  - 有简历时默认选中第一份。
  - 再次点击已选中简历时取消选择。
  - 仅要求 `position` 即可开始。
  - 无选中简历时从请求体中省略 `resumeId`。
  - 调整空状态文案，说明上传简历为可选项。
- 新建 `src/app/api/interviews/__tests__/route.test.ts`
  - 测试不带 `resumeId`、带 `resumeId`、以及无效 `resumeId` 的面试创建。
- 修改 `src/app/api/interviews/route.ts`
  - 允许空的 `finalResumeText`。
  - 当 `finalResumeText.trim()` 为空时创建无简历开场消息。
- 修改 `src/lib/__tests__/deepseek.test.ts`
  - 新增空 `resumeText` 的提示词和聚合测试。
- 修改 `src/lib/deepseek.ts`
  - 按 `resumeText.trim()` 分支系统提示词和聚合提示词。
- 新建 `src/app/api/interviews/[id]/finish/__tests__/route.test.ts`
  - 测试无简历聚合结果持久化 `resumeSuggestions: ""`。
- 修改 `src/app/api/interviews/[id]/finish/route.ts`
  - 当聚合结果缺失该字段时，持久化 `resumeSuggestions: ""`。
- 新建 `src/components/interview/__tests__/EvaluationText.test.tsx`
  - 测试简历建议块的可见性。
- 新建 `src/app/results/[id]/__tests__/page.test.tsx`
  - 测试结果页在 `resumeText` 为空时隐藏简历建议，在有简历时保留。
- 修改 `src/components/interview/EvaluationText.tsx`
  - 新增 `showResumeSuggestions`。
- 修改 `src/components/interview/ScoreCard.tsx`
  - 传入 `showResumeSuggestions={true}` 以保持旧包装器行为。
- 修改 `src/app/results/[id]/page.tsx`
  - 从 `interview.resumeText.trim()` 推导 `showResumeSuggestions`，并在所有结果状态中传入 `EvaluationText`。

## 参考检查

编辑前使用本地 Next.js 文档：

- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
  - Route handlers 在 `app` 目录下的 `route.ts` 中，使用 Web `Request`/`Response` 加 `NextRequest`/`NextResponse`，非 GET handler 不被缓存。
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
  - `SetupForm` 和 `ResultsPage` 是客户端组件，因为它们使用 state、effects、事件处理器、hooks 和浏览器 fetch。
- `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`
  - 客户端事件处理器可通过 route handlers 调用服务端变更；服务端路由必须校验认证和授权。

---

### 任务 1：设置表单无简历选择

**文件：**
- 新建：`src/components/interview/__tests__/SetupForm.noResume.test.tsx`
- 修改：`src/components/interview/SetupForm.tsx`

- [ ] **步骤 1：编写失败的设置表单测试**

新建 `src/components/interview/__tests__/SetupForm.noResume.test.tsx`：

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import SetupForm from "../SetupForm";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

type FetchCall = {
  input: RequestInfo | URL;
  init?: RequestInit;
};

function mockFetchWithResumes(resumes: Array<{ id: number; filename: string }>) {
  const calls: FetchCall[] = [];
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });

    if (String(input) === "/api/resumes") {
      return {
        ok: true,
        json: async () => resumes,
      } as Response;
    }

    if (String(input) === "/api/interviews") {
      return {
        ok: true,
        json: async () => ({ interviewId: 123, mode: "text" }),
      } as Response;
    }

    return {
      ok: false,
      json: async () => ({ error: "unexpected request" }),
    } as Response;
  });
  return calls;
}

async function chooseFrontendPosition() {
  const positionInput = screen.getByPlaceholderText("搜索岗位（例如：前端、产品经理、金融分析师...）");
  fireEvent.focus(positionInput);
  fireEvent.change(positionInput, { target: { value: "前端" } });
  fireEvent.click(await screen.findByRole("button", { name: "前端开发工程师" }));
}

function getInterviewPostBody(calls: FetchCall[]) {
  const postCall = calls.find((call) => String(call.input) === "/api/interviews");
  expect(postCall).toBeTruthy();
  return JSON.parse(String(postCall?.init?.body));
}

describe("SetupForm 无简历模式", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pushMock.mockReset();
  });

  test("多份简历时默认选中第一份保存的简历", async () => {
    const calls = mockFetchWithResumes([
      { id: 1, filename: "first.pdf" },
      { id: 2, filename: "second.pdf" },
    ]);

    render(<SetupForm />);

    expect(await screen.findByText("first.pdf")).toBeTruthy();
    await chooseFrontendPosition();
    fireEvent.click(screen.getByRole("button", { name: "开始面试" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/interview/chat?id=123");
    });
    expect(getInterviewPostBody(calls)).toMatchObject({
      position: "前端开发工程师",
      resumeId: 1,
      questionCount: 12,
      maxRounds: 2,
      difficulty: "mid",
      mode: "text",
    });
  });

  test("再次点击已选中的简历可清除简历选择", async () => {
    const calls = mockFetchWithResumes([{ id: 7, filename: "resume.pdf" }]);

    render(<SetupForm />);

    const resumeButton = await screen.findByRole("button", { name: /resume\.pdf/ });
    fireEvent.click(resumeButton);
    await chooseFrontendPosition();
    fireEvent.click(screen.getByRole("button", { name: "开始面试" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/interview/chat?id=123");
    });
    expect(getInterviewPostBody(calls)).not.toHaveProperty("resumeId");
  });

  test("无保存简历时允许开始面试", async () => {
    const calls = mockFetchWithResumes([]);

    render(<SetupForm />);

    expect(await screen.findByText("暂无保存的简历")).toBeTruthy();
    await chooseFrontendPosition();
    const startButton = screen.getByRole("button", { name: "开始面试" });
    expect(startButton).not.toBeDisabled();
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/interview/chat?id=123");
    });
    expect(getInterviewPostBody(calls)).not.toHaveProperty("resumeId");
  });
});
```

- [ ] **步骤 2：运行设置表单测试，验证失败**

运行：

```bash
pnpm test src/components/interview/__tests__/SetupForm.noResume.test.tsx
```

预期：失败。第一个测试在有多个简历时不发送默认简历，第二个测试仍发送 `resumeId`，第三个测试的开始按钮在没有简历时被禁用。

- [ ] **步骤 3：实现设置表单无简历行为**

修改 `src/components/interview/SetupForm.tsx`。

将简历加载 effect 从仅在一份简历时选中，改为默认选中第一份：

```tsx
  useEffect(() => {
    fetch("/api/resumes")
      .then((r) => r.json())
      .then((data) => {
        setSavedResumes(data);
        if (data.length > 0) setSelectedResumeId(data[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingResumes(false));
  }, []);
```

修改 `handleStart()`，不要求 `selectedResumeId`，且无选中简历时省略 `resumeId`：

```tsx
  async function handleStart() {
    if (!position) {
      setError("请选择目标岗位");
      return;
    }

    setLoading(true);
    const payload = {
      position,
      ...(selectedResumeId ? { resumeId: selectedResumeId } : {}),
      questionCount,
      maxRounds,
      difficulty,
      mode,
    };
    const res = await fetch("/api/interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    const targetPath = mode === "voice" ? `/interview/voice?id=${data.interviewId}` : `/interview/chat?id=${data.interviewId}`;
    router.push(targetPath);
  }
```

修改空简历状态文案：

```tsx
          <div className="text-center py-8 border border-white/8 rounded-xl">
            <p className="text-text-muted text-sm mb-3">暂无保存的简历，可直接开始无简历面试</p>
            <Link href="/resumes" className="text-accent text-sm hover:underline font-medium">
              上传简历以获得更个性化的问题
            </Link>
          </div>
```

修改简历卡片点击处理器，点击已选中的卡片时清除选择：

```tsx
                onClick={() => setSelectedResumeId((current) => (current === r.id ? null : r.id))}
```

在简历选择器下方、已保存简历列表或空状态之后添加无简历提示：

```tsx
        {!loadingResumes && !selectedResumeId && (
          <p className="mt-2 text-xs text-text-muted">未选择简历，将按目标岗位进行通用模拟面试。</p>
        )}
```

修改开始按钮的禁用条件：

```tsx
      <Button onClick={handleStart} loading={loading} disabled={!position}>
        开始面试
      </Button>
```

- [ ] **步骤 4：运行设置表单测试，验证通过**

运行：

```bash
pnpm test src/components/interview/__tests__/SetupForm.noResume.test.tsx
```

预期：通过。

- [ ] **步骤 5：提交设置表单变更**

运行：

```bash
git add src/components/interview/SetupForm.tsx src/components/interview/__tests__/SetupForm.noResume.test.tsx
git commit -m "feat: allow setup without resume"
```

预期：提交成功。

---

### 任务 2：面试创建 API 支持无简历

**文件：**
- 新建：`src/app/api/interviews/__tests__/route.test.ts`
- 修改：`src/app/api/interviews/route.ts`

- [ ] **步骤 1：编写失败的面试创建 API 测试**

新建 `src/app/api/interviews/__tests__/route.test.ts`：

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";

type MockInterview = {
  id: number;
  user: { id: number };
  position: string;
  title: string;
  resumeText: string;
  status: string;
  questionCount: number;
  difficulty: string;
  currentRound: number;
  maxRounds: number;
  mode: string;
};

const mocks = vi.hoisted(() => {
  const interviewRepo = {
    find: vi.fn(),
    findOne: vi.fn(),
    count: vi.fn(),
    create: vi.fn((data: Omit<MockInterview, "id">) => ({ id: 101, ...data })),
    save: vi.fn(async (interview: MockInterview) => interview),
  };
  const resumeRepo = {
    findOne: vi.fn(),
  };
  const messageRepo = {
    create: vi.fn((data: unknown) => data),
    save: vi.fn(async (message: unknown) => message),
  };
  return {
    getUserId: vi.fn(),
    getRepository: vi.fn((entity: { name?: string }) => {
      if (entity.name === "Interview") return interviewRepo;
      if (entity.name === "Resume") return resumeRepo;
      if (entity.name === "Message") return messageRepo;
      throw new Error(`Unexpected repository: ${entity.name}`);
    }),
    interviewRepo,
    resumeRepo,
    messageRepo,
  };
});

vi.mock("@/lib/utils", () => ({
  getUserId: mocks.getUserId,
}));

vi.mock("@/lib/database", () => ({
  getDataSource: vi.fn(async () => ({
    getRepository: mocks.getRepository,
  })),
}));

vi.mock("@/entities/Interview", () => ({
  Interview: class Interview {},
}));

vi.mock("@/entities/Resume", () => ({
  Resume: class Resume {},
}));

vi.mock("@/entities/Message", () => ({
  Message: class Message {},
}));

function request(body: unknown) {
  return {
    json: async () => body,
  } as never;
}

describe("POST /api/interviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserId.mockReturnValue(9);
    mocks.interviewRepo.count.mockResolvedValue(0);
    mocks.interviewRepo.create.mockImplementation((data: Omit<MockInterview, "id">) => ({ id: 101, ...data }));
    mocks.interviewRepo.save.mockImplementation(async (interview: MockInterview) => interview);
    mocks.resumeRepo.findOne.mockResolvedValue(null);
    mocks.messageRepo.create.mockImplementation((data: unknown) => data);
    mocks.messageRepo.save.mockImplementation(async (message: unknown) => message);
  });

  test("省略 resumeId 时创建无简历面试", async () => {
    const { POST } = await import("../route");

    const response = await POST(request({
      position: "前端开发工程师",
      questionCount: 12,
      maxRounds: 2,
      difficulty: "mid",
      mode: "text",
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ interviewId: 101, mode: "text" });
    expect(mocks.resumeRepo.findOne).not.toHaveBeenCalled();
    expect(mocks.interviewRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      user: { id: 9 },
      position: "前端开发工程师",
      resumeText: "",
      status: "ongoing",
      questionCount: 12,
      difficulty: "mid",
      currentRound: 1,
      maxRounds: 2,
      mode: "text",
    }));
    expect(mocks.messageRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining("岗位能力、项目经历和综合素质"),
      round: 1,
      questionNumber: 1,
    }));
  });

  test("有 resumeId 时保持基于简历的创建", async () => {
    mocks.resumeRepo.findOne.mockResolvedValue({ id: 5, content: "3年React经验" });
    const { POST } = await import("../route");

    const response = await POST(request({
      position: "前端开发工程师",
      resumeId: 5,
      questionCount: 12,
      maxRounds: 2,
      difficulty: "mid",
      mode: "voice",
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ interviewId: 101, mode: "voice" });
    expect(mocks.resumeRepo.findOne).toHaveBeenCalledWith({
      where: { id: 5, user: { id: 9 } },
    });
    expect(mocks.interviewRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      resumeText: "3年React经验",
      mode: "voice",
    }));
  });

  test("拒绝无效或未授权的 resumeId", async () => {
    mocks.resumeRepo.findOne.mockResolvedValue(null);
    const { POST } = await import("../route");

    const response = await POST(request({
      position: "前端开发工程师",
      resumeId: 99,
    }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "简历不存在" });
    expect(mocks.interviewRepo.save).not.toHaveBeenCalled();
    expect(mocks.messageRepo.save).not.toHaveBeenCalled();
  });
});
```

- [ ] **步骤 2：运行面试 API 测试，验证失败**

运行：

```bash
pnpm test src/app/api/interviews/__tests__/route.test.ts
```

预期：失败。无简历测试收到 `400` 和“简历内容不能为空”。

- [ ] **步骤 3：实现无简历面试创建**

修改 `src/app/api/interviews/route.ts`。

保留此初始化：

```ts
  const { resumeText, resumeId } = body;
  let { position, questionCount = 12, difficulty = "mid", maxRounds = 2, mode } = body;
  let finalResumeText = resumeText?.trim() ? resumeText : "";
```

保留前一面试分支，保持空简历文本：

```ts
  if (body.prevInterviewId) {
    const prev = await ds.getRepository(Interview).findOne({
      where: { id: body.prevInterviewId, user: { id: userId } },
    });
    if (!prev) {
      return NextResponse.json({ error: "面试记录不存在" }, { status: 404 });
    }
    position = prev.position;
    finalResumeText = prev.resumeText;
    questionCount = prev.questionCount;
    difficulty = prev.difficulty;
    maxRounds = prev.maxRounds;
    mode = prev.mode;
  }
```

仅在 `resumeId` 存在时查找简历：

```ts
  if (resumeId) {
    const resume = await ds.getRepository(Resume).findOne({
      where: { id: parseInt(String(resumeId), 10), user: { id: userId } },
    });
    if (!resume) {
      return NextResponse.json({ error: "简历不存在" }, { status: 404 });
    }
    finalResumeText = resume.content;
  }
```

移除旧的空简历守卫：

```ts
  if (!finalResumeText) {
    return NextResponse.json({ error: "简历内容不能为空" }, { status: 400 });
  }
```

用分支替换开场消息内容：

```ts
  const openingContent = finalResumeText.trim()
    ? `同学你好，很高兴见到你。我是今天${interview.position}岗位的面试官，要不咱们先聊聊你的基本情况？请简单介绍一下自己。`
    : `同学你好，很高兴见到你。我是今天${interview.position}岗位的面试官。我们会围绕岗位能力、项目经历和综合素质进行交流。请先简单介绍一下自己，以及你和这个岗位相关的经历。`;

  const interviewerMsg = msgRepo.create({
    interview: { id: interview.id },
    role: "interviewer",
    content: openingContent,
    round: 1,
    questionNumber: 1,
  });
```

- [ ] **步骤 4：运行面试 API 测试，验证通过**

运行：

```bash
pnpm test src/app/api/interviews/__tests__/route.test.ts
```

预期：通过。

- [ ] **步骤 5：提交面试 API 变更**

运行：

```bash
git add src/app/api/interviews/route.ts src/app/api/interviews/__tests__/route.test.ts
git commit -m "feat: create interviews without resumes"
```

预期：提交成功。

---

### 任务 3：DeepSeek 提示词分支

**文件：**
- 修改：`src/lib/__tests__/deepseek.test.ts`
- 修改：`src/lib/deepseek.ts`

- [ ] **步骤 1：编写失败的 DeepSeek 提示词测试**

修改 `src/lib/__tests__/deepseek.test.ts`。

在 `describe("buildAggregationMessage", () => { ... })` 内添加以下测试：

```ts
  test("无简历聚合输出 schema 中省略简历建议", () => {
    const msg = buildAggregationMessage(questionReviews, "");

    const content = msg.content as string;
    expect(content).not.toContain("resumeSuggestions");
    expect(content).not.toContain("## 候选人简历");
    expect(content).toContain("候选人未提供简历");
    expect(content).toContain("practiceSuggestions");
  });

  test("有简历聚合保留简历建议", () => {
    const msg = buildAggregationMessage(questionReviews, resumeText);

    const content = msg.content as string;
    expect(content).toContain("resumeSuggestions");
    expect(content).toContain("## 候选人简历");
  });
```

在 `describe("buildInterviewSystemMessage", () => { ... })` 内添加以下测试：

```ts
  test("简历文本为空时使用无简历提示词", () => {
    const msg = buildInterviewSystemMessage(
      "前端工程师",
      "",
      12,
      "mid",
      1,
      1
    );

    const content = msg.content as string;
    expect(content).toContain("候选人没有提供简历");
    expect(content).toContain("通过候选人的自我介绍和后续回答建立背景");
    expect(content).toContain("岗位基础");
    expect(content).not.toContain("## 候选人简历");
    expect(content).not.toContain("根据你的简历");
  });

  test("简历文本存在时保留简历章节", () => {
    const msg = buildInterviewSystemMessage(
      "前端工程师",
      "3年React经验",
      12,
      "mid",
      1,
      1
    );

    const content = msg.content as string;
    expect(content).toContain("## 候选人简历");
    expect(content).toContain("3年React经验");
  });
```

- [ ] **步骤 2：运行 DeepSeek 测试，验证失败**

运行：

```bash
pnpm test src/lib/__tests__/deepseek.test.ts
```

预期：失败，因为无简历提示词仍包含 `## 候选人简历` 和 `resumeSuggestions`。

- [ ] **步骤 3：实现系统提示词分支**

修改 `src/lib/deepseek.ts` 中的 `buildInterviewSystemMessage()`。

在现有 `prevBlock` 定义附近添加：

```ts
  const hasResume = resumeText.trim().length > 0;
  const resumeContextBlock = hasResume
    ? `## 候选人简历

${resumeText}`
    : `## 面试背景

候选人没有提供简历。请通过候选人的自我介绍和后续回答建立背景，再围绕岗位基础、场景判断、项目经历、沟通表达和问题解决能力继续提问。不要说"根据你的简历"，也不要引用不存在的简历细节。`;
```

替换返回的 `SystemMessage` 字符串中硬编码的简历章节：

```ts
${prevBlock}
---
${resumeContextBlock}

---
## 开场

${startInstruction}`,
```

- [ ] **步骤 4：实现聚合提示词分支**

修改 `src/lib/deepseek.ts` 中的 `buildAggregationMessage()`。

在 `annotatedConversation` 之后添加以下常量：

```ts
  const hasResume = resumeText.trim().length > 0;
  const outputSchema = hasResume
    ? `{
  "overallScore": <0-100>,
  "categories": {
    "tech": <0-100>,
    "project": <0-100>,
    "softSkills": <0-100>
  },
  "strengths": "<优点>",
  "weaknesses": "<待改进>",
  "resumeSuggestions": "<简历优化建议>",
  "practiceSuggestions": [
    {
      "area": "<薄弱领域>",
      "description": "<具体问题表现，50字以内>",
      "suggestion": "<可执行的练习方案，100字以内>"
    }
  ]
}`
    : `{
  "overallScore": <0-100>,
  "categories": {
    "tech": <0-100>,
    "project": <0-100>,
    "softSkills": <0-100>
  },
  "strengths": "<优点>",
  "weaknesses": "<待改进>",
  "practiceSuggestions": [
    {
      "area": "<薄弱领域>",
      "description": "<具体问题表现，50字以内>",
      "suggestion": "<可执行的练习方案，100字以内>"
    }
  ]
}`;

  const resumeBlock = hasResume
    ? `## 候选人简历

${resumeText}`
    : `## 面试背景

候选人未提供简历。本次综合评估只基于面试对话记录和逐题评分，不输出简历优化建议。`;
```

替换当前硬编码的 JSON schema 和末尾简历章节为：

```ts
    `请根据以下面试对话记录（含逐题评分），对候选人进行综合评估。输出纯 JSON 格式（不要 markdown 代码块）：

${outputSchema}

## 注意事项

- overallScore 综合逐题得分和整体表现判断，不要简单取平均值
- categories 三个维度各评分，参照逐题得分的分布
- strengths/weaknesses 基于对话中的实际表现，避免空洞评价
- practiceSuggestions 针对薄弱环节给出 2-4 条结构化练习建议

---

## 面试对话记录（含逐题评分）

${annotatedConversation}

---

${resumeBlock}`,
```

- [ ] **步骤 5：运行 DeepSeek 测试，验证通过**

运行：

```bash
pnpm test src/lib/__tests__/deepseek.test.ts
```

预期：通过。

- [ ] **步骤 6：提交 DeepSeek 提示词变更**

运行：

```bash
git add src/lib/deepseek.ts src/lib/__tests__/deepseek.test.ts
git commit -m "feat: adapt prompts for no-resume interviews"
```

预期：提交成功。

---

### 任务 4：无简历聚合的评估持久化

**文件：**
- 新建：`src/app/api/interviews/[id]/finish/__tests__/route.test.ts`
- 修改：`src/app/api/interviews/[id]/finish/route.ts`

- [ ] **步骤 1：编写失败的 finish-route 持久化测试**

新建 `src/app/api/interviews/[id]/finish/__tests__/route.test.ts`：

```ts
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const interviewRepo = {
    findOne: vi.fn(),
    update: vi.fn(),
  };
  const evaluationRepo = {
    delete: vi.fn(),
    create: vi.fn((data: unknown) => data),
    save: vi.fn(async (evaluation: unknown) => evaluation),
  };
  return {
    getUserId: vi.fn(),
    getRepository: vi.fn((entity: { name?: string }) => {
      if (entity.name === "Interview") return interviewRepo;
      if (entity.name === "Evaluation") return evaluationRepo;
      if (entity.name === "Message") return {};
      throw new Error(`Unexpected repository: ${entity.name}`);
    }),
    interviewRepo,
    evaluationRepo,
    loggerError: vi.fn(),
    buildSingleQuestionEvaluationMessage: vi.fn(() => ({})),
    buildAggregationMessage: vi.fn(() => ({})),
    getEvaluation: vi.fn(),
    buildRoundSummaryMessage: vi.fn(() => ({})),
    getRoundSummary: vi.fn(),
    getPassThreshold: vi.fn(),
  };
});

vi.mock("@/lib/utils", () => ({
  getUserId: mocks.getUserId,
}));

vi.mock("@/lib/database", () => ({
  getDataSource: vi.fn(async () => ({
    getRepository: mocks.getRepository,
  })),
}));

vi.mock("@/entities/Interview", () => ({
  Interview: class Interview {},
}));

vi.mock("@/entities/Evaluation", () => ({
  Evaluation: class Evaluation {},
}));

vi.mock("@/entities/Message", () => ({
  Message: class Message {},
}));

vi.mock("@/lib/deepseek", () => ({
  buildSingleQuestionEvaluationMessage: mocks.buildSingleQuestionEvaluationMessage,
  buildAggregationMessage: mocks.buildAggregationMessage,
  getEvaluation: mocks.getEvaluation,
  buildRoundSummaryMessage: mocks.buildRoundSummaryMessage,
  getRoundSummary: mocks.getRoundSummary,
  getPassThreshold: mocks.getPassThreshold,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

function request() {
  return {
    headers: new Headers(),
  } as never;
}

describe("POST /api/interviews/[id]/finish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserId.mockReturnValue(9);
    mocks.interviewRepo.findOne.mockResolvedValue({
      id: 123,
      user: { id: 9 },
      position: "前端开发工程师",
      status: "ongoing",
      currentRound: 1,
      maxRounds: 1,
      difficulty: "mid",
      resumeText: "",
      messages: [
        { id: 1, role: "interviewer", content: "介绍自己", round: 1, questionNumber: 1 },
        { id: 2, role: "user", content: "我是前端工程师", round: 1, questionNumber: null },
      ],
    });
    mocks.interviewRepo.update.mockResolvedValue({ affected: 1 });
    mocks.evaluationRepo.delete.mockResolvedValue({ affected: 0 });
    mocks.evaluationRepo.create.mockImplementation((data: unknown) => data);
    mocks.evaluationRepo.save.mockImplementation(async (evaluation: unknown) => evaluation);
    mocks.getEvaluation
      .mockResolvedValueOnce(JSON.stringify({ score: 80, comment: "表达清晰" }))
      .mockResolvedValueOnce(JSON.stringify({
        overallScore: 80,
        categories: { tech: 80, project: 75, softSkills: 85 },
        strengths: "表达清晰",
        weaknesses: "深度不足",
        practiceSuggestions: [],
      }));
    mocks.getRoundSummary.mockResolvedValue("本轮总结");
    mocks.getPassThreshold.mockReturnValue(60);
  });

  test("聚合结果省略 resumeSuggestions 时存储空字符串", async () => {
    const { POST } = await import("../route");

    const response = await POST(request(), { params: Promise.resolve({ id: "123" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "evaluating" });

    await waitFor(() => {
      expect(mocks.evaluationRepo.save).toHaveBeenCalled();
    });
    expect(mocks.evaluationRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      resumeSuggestions: "",
      strengths: "表达清晰",
      weaknesses: "深度不足",
    }));
  });
});
```

- [ ] **步骤 2：运行 finish-route 测试，验证失败**

运行：

```bash
pnpm test 'src/app/api/interviews/[id]/finish/__tests__/route.test.ts'
```

预期：失败，因为当聚合响应省略该字段时 `resumeSuggestions` 当前被创建为 `undefined`。

- [ ] **步骤 3：实现空简历建议回退**

修改 `src/app/api/interviews/[id]/finish/route.ts`。

将评估创建块从：

```ts
      const evaluation = ds.getRepository(Evaluation).create({
        interview: { id: interview.id },
        round: currentRound,
        overallScore: parsed.overallScore,
        categories: parsed.categories,
        strengths: parsed.strengths,
        weaknesses: parsed.weaknesses,
        resumeSuggestions: parsed.resumeSuggestions,
        questionReviews,
        practiceSuggestions: parsed.practiceSuggestions || null,
        roundSummary,
      });
```

改为：

```ts
      const evaluation = ds.getRepository(Evaluation).create({
        interview: { id: interview.id },
        round: currentRound,
        overallScore: parsed.overallScore,
        categories: parsed.categories,
        strengths: parsed.strengths,
        weaknesses: parsed.weaknesses,
        resumeSuggestions: typeof parsed.resumeSuggestions === "string" ? parsed.resumeSuggestions : "",
        questionReviews,
        practiceSuggestions: parsed.practiceSuggestions || null,
        roundSummary,
      });
```

- [ ] **步骤 4：运行聚焦的 DeepSeek 和面试 API 测试**

运行：

```bash
pnpm test src/lib/__tests__/deepseek.test.ts src/app/api/interviews/__tests__/route.test.ts 'src/app/api/interviews/[id]/finish/__tests__/route.test.ts'
```

预期：通过。

- [ ] **步骤 5：提交评估持久化变更**

运行：

```bash
git add 'src/app/api/interviews/[id]/finish/route.ts' 'src/app/api/interviews/[id]/finish/__tests__/route.test.ts'
git commit -m "fix: persist empty resume suggestions for no-resume evaluations"
```

预期：提交成功。

---

### 任务 5：结果 UI 隐藏简历建议

**文件：**
- 新建：`src/components/interview/__tests__/EvaluationText.test.tsx`
- 新建：`src/app/results/[id]/__tests__/page.test.tsx`
- 修改：`src/components/interview/EvaluationText.tsx`
- 修改：`src/components/interview/ScoreCard.tsx`
- 修改：`src/app/results/[id]/page.tsx`

- [ ] **步骤 1：编写失败的 EvaluationText 测试**

新建 `src/components/interview/__tests__/EvaluationText.test.tsx`：

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { EvaluationText } from "../EvaluationText";

describe("EvaluationText", () => {
  test("需要时显示简历建议", () => {
    render(
      <EvaluationText
        strengths="表达清晰"
        weaknesses="深度不足"
        resumeSuggestions="突出 React 项目指标"
        showResumeSuggestions={true}
      />
    );

    expect(screen.getByText("简历优化建议")).toBeTruthy();
    expect(screen.getByText("突出 React 项目指标")).toBeTruthy();
  });

  test("无简历面试时隐藏简历建议", () => {
    render(
      <EvaluationText
        strengths="表达清晰"
        weaknesses="深度不足"
        resumeSuggestions="不会展示"
        showResumeSuggestions={false}
      />
    );

    expect(screen.queryByText("简历优化建议")).toBeNull();
    expect(screen.queryByText("不会展示")).toBeNull();
  });
});
```

- [ ] **步骤 2：编写失败的 ResultsPage 测试**

新建 `src/app/results/[id]/__tests__/page.test.tsx`：

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ResultsPage from "../page";

const pushMock = vi.fn();
const fetchDataMock = vi.fn();
const handleRetryMock = vi.fn();

const pollingMock = vi.hoisted(() => ({
  useResultsPolling: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "123" }),
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/hooks/useResultsPolling", () => ({
  useResultsPolling: pollingMock.useResultsPolling,
}));

vi.mock("@/components/interview/InterviewReview", () => ({
  InterviewReview: () => <div data-testid="interview-review" />,
}));

function resultData(resumeText: string) {
  return {
    interview: {
      id: 123,
      title: "面试1: 前端开发工程师",
      position: "前端开发工程师",
      status: "done",
      resumeText,
      questionCount: 12,
      difficulty: "mid",
      currentRound: 1,
      maxRounds: 1,
      mode: "text",
      createdAt: "2026-06-05T00:00:00.000Z",
    },
    messages: [
      { id: 1, role: "interviewer", content: "介绍自己", round: 1, questionNumber: 1, createdAt: "2026-06-05T00:00:00.000Z" },
      { id: 2, role: "user", content: "我是前端工程师", round: 1, questionNumber: null, createdAt: "2026-06-05T00:00:00.000Z" },
    ],
    evaluations: [
      {
        round: 1,
        overallScore: 80,
        categories: { tech: 80, project: 75, softSkills: 85 },
        strengths: "表达清晰",
        weaknesses: "深度不足",
        resumeSuggestions: "突出项目指标",
        questionReviews: [],
        practiceSuggestions: null,
        roundSummary: null,
      },
    ],
  };
}

describe("ResultsPage 无简历渲染", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pollingMock.useResultsPolling.mockReturnValue({
      data: resultData(""),
      error: "",
      timedOut: false,
      fetchData: fetchDataMock,
      handleRetry: handleRetryMock,
    });
  });

  test("面试 resumeText 为空时隐藏简历建议", () => {
    render(<ResultsPage />);

    expect(screen.queryByText("简历优化建议")).toBeNull();
    expect(screen.queryByText("突出项目指标")).toBeNull();
    expect(screen.getByText("表达清晰")).toBeTruthy();
    expect(screen.getByText("深度不足")).toBeTruthy();
  });

  test("面试有 resumeText 时显示简历建议", () => {
    pollingMock.useResultsPolling.mockReturnValue({
      data: resultData("3年React经验"),
      error: "",
      timedOut: false,
      fetchData: fetchDataMock,
      handleRetry: handleRetryMock,
    });

    render(<ResultsPage />);

    expect(screen.getByText("简历优化建议")).toBeTruthy();
    expect(screen.getByText("突出项目指标")).toBeTruthy();
  });
});
```

- [ ] **步骤 3：运行结果测试，验证失败**

运行：

```bash
pnpm test src/components/interview/__tests__/EvaluationText.test.tsx src/app/results/[id]/__tests__/page.test.tsx
```

预期：失败，因为 `EvaluationText` 不接受 `showResumeSuggestions` 且始终渲染简历建议块。

- [ ] **步骤 4：实现 EvaluationText 可见性 prop**

修改 `src/components/interview/EvaluationText.tsx`。

修改函数签名：

```tsx
export function EvaluationText({
  strengths,
  weaknesses,
  resumeSuggestions,
  roundSummary,
  showResumeSuggestions = true,
}: {
  strengths: string;
  weaknesses: string;
  resumeSuggestions: string;
  roundSummary?: string | null;
  showResumeSuggestions?: boolean;
}) {
```

包裹简历建议块：

```tsx
      {showResumeSuggestions && (
        <div className="bg-blue-500/10 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-blue-400 mb-2 font-display inline-flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
            简历优化建议
          </h3>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{resumeSuggestions}</p>
        </div>
      )}
```

- [ ] **步骤 5：保持 ScoreCard 包装器行为**

修改 `src/components/interview/ScoreCard.tsx`。

修改 `EvaluationText` 调用：

```tsx
      <EvaluationText strengths={strengths} weaknesses={weaknesses} resumeSuggestions={resumeSuggestions} showResumeSuggestions={true} />
```

- [ ] **步骤 6：从 ResultsPage 传入可见性**

修改 `src/app/results/[id]/page.tsx`。

在：

```tsx
  const { interview, evaluations, messages } = data;
```

之后添加：

```tsx
  const showResumeSuggestions = interview.resumeText.trim().length > 0;
```

修改部分评估的 `EvaluationText` 调用：

```tsx
                <EvaluationText
                  strengths={partialEval.strengths}
                  weaknesses={partialEval.weaknesses}
                  resumeSuggestions={partialEval.resumeSuggestions}
                  roundSummary={partialEval.roundSummary}
                  showResumeSuggestions={showResumeSuggestions}
                />
```

修改最终选中评估的 `EvaluationText` 调用：

```tsx
            <EvaluationText
              strengths={selectedEval.strengths}
              weaknesses={selectedEval.weaknesses}
              resumeSuggestions={selectedEval.resumeSuggestions}
              roundSummary={selectedEval.roundSummary}
              showResumeSuggestions={showResumeSuggestions}
            />
```

- [ ] **步骤 7：运行结果测试，验证通过**

运行：

```bash
pnpm test src/components/interview/__tests__/EvaluationText.test.tsx src/app/results/[id]/__tests__/page.test.tsx
```

预期：通过。

- [ ] **步骤 8：提交结果 UI 变更**

运行：

```bash
git add src/components/interview/EvaluationText.tsx src/components/interview/ScoreCard.tsx src/components/interview/__tests__/EvaluationText.test.tsx 'src/app/results/[id]/page.tsx' 'src/app/results/[id]/__tests__/page.test.tsx'
git commit -m "feat: hide resume suggestions for no-resume results"
```

预期：提交成功。

---

### 任务 6：全量验证

**文件：**
- 无新文件。

- [ ] **步骤 1：运行全部测试**

运行：

```bash
pnpm test
```

预期：通过。

- [ ] **步骤 2：运行 lint**

运行：

```bash
pnpm lint
```

预期：通过。

- [ ] **步骤 3：运行生产构建**

运行：

```bash
pnpm build
```

预期：通过。

- [ ] **步骤 4：检查最终 diff**

运行：

```bash
git status --short
git log --oneline -6
```

预期：

- `git status --short` 无输出。
- 最近提交包括：
  - `feat: allow setup without resume`
  - `feat: create interviews without resumes`
  - `feat: adapt prompts for no-resume interviews`
  - `fix: persist empty resume suggestions for no-resume evaluations`
  - `feat: hide resume suggestions for no-resume results`

## 计划自查

- Spec 覆盖：设置页无简历入口、API 创建、提示词分支、评估 schema 分支、空简历建议持久化、结果 UI 隐藏——均有对应任务。
- 占位符扫描：无任务包含未完成标记语言或跨任务简写。
- 类型一致性：`resumeText` 保持字符串，`resumeId` 被省略而非发送 `null`，`showResumeSuggestions` 为布尔值，`resumeSuggestions` 保持字符串以兼容数据库。
- 范围：无 schema 迁移、无 `contextMode`、无独立 API、无替代建议板块。
