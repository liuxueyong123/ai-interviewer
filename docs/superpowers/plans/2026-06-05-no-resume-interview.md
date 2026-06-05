# No-Resume Interview Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users start text or voice interviews without selecting a resume, while keeping resume-based behavior when a resume is selected.

**Architecture:** Treat no-resume interviews as existing `Interview` records whose `resumeText` is an empty string. Keep the existing setup page and interview APIs, branch prompts and result rendering from `resumeText.trim()`, and store an empty `resumeSuggestions` value for no-resume evaluations.

**Tech Stack:** Next.js 16.2.6 App Router Route Handlers, React 19 Client Components, TypeScript, TypeORM, LangChain message helpers, Vitest, Testing Library, happy-dom.

---

## Scope Check

The approved spec covers one feature path: no-resume interview as the absence of resume content. It does not introduce a new database mode, new API, migration, background profile form, or replacement advice section. This is small enough for a single implementation plan.

## File Structure

- Create `src/components/interview/__tests__/SetupForm.noResume.test.tsx`
  - Tests default resume selection, deselection, no-resume request payloads, and no-resume start with an empty resume list.
- Modify `src/components/interview/SetupForm.tsx`
  - Default-select the first resume when any resumes exist.
  - Toggle the selected resume off when clicked again.
  - Require only `position` to start.
  - Omit `resumeId` from the request body when no resume is selected.
  - Adjust empty-state copy to explain resume upload is optional.
- Create `src/app/api/interviews/__tests__/route.test.ts`
  - Tests interview creation without `resumeId`, with `resumeId`, and with invalid `resumeId`.
- Modify `src/app/api/interviews/route.ts`
  - Allow empty `finalResumeText`.
  - Create no-resume opening messages when `finalResumeText.trim()` is empty.
- Modify `src/lib/__tests__/deepseek.test.ts`
  - Adds prompt and aggregation tests for empty `resumeText`.
- Modify `src/lib/deepseek.ts`
  - Branch system prompt and aggregation prompt by `resumeText.trim()`.
- Create `src/app/api/interviews/[id]/finish/__tests__/route.test.ts`
  - Tests that no-resume aggregation results persist `resumeSuggestions: ""`.
- Modify `src/app/api/interviews/[id]/finish/route.ts`
  - Persist `resumeSuggestions: ""` when the aggregation result omits that field.
- Create `src/components/interview/__tests__/EvaluationText.test.tsx`
  - Tests the resume suggestion block visibility.
- Create `src/app/results/[id]/__tests__/page.test.tsx`
  - Tests that the results page hides resume suggestions for empty `resumeText` and keeps them for resume-based interviews.
- Modify `src/components/interview/EvaluationText.tsx`
  - Add `showResumeSuggestions`.
- Modify `src/components/interview/ScoreCard.tsx`
  - Pass `showResumeSuggestions={true}` to preserve legacy wrapper behavior.
- Modify `src/app/results/[id]/page.tsx`
  - Derive `showResumeSuggestions` from `interview.resumeText.trim()` and pass it to `EvaluationText` in all result states.

## Reference Checks

Use the local Next.js docs before editing:

- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
  - Route handlers live under `app` in `route.ts`, use Web `Request`/`Response` plus `NextRequest`/`NextResponse`, and non-GET handlers are not cached.
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
  - `SetupForm` and `ResultsPage` are Client Components because they use state, effects, event handlers, hooks, and browser fetch.
- `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`
  - Client-side event handlers may call server mutations through route handlers; server-side routes must verify authentication and authorization.

---

### Task 1: Setup Form No-Resume Selection

**Files:**
- Create: `src/components/interview/__tests__/SetupForm.noResume.test.tsx`
- Modify: `src/components/interview/SetupForm.tsx`

- [ ] **Step 1: Write failing setup form tests**

Create `src/components/interview/__tests__/SetupForm.noResume.test.tsx`:

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

describe("SetupForm no-resume mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pushMock.mockReset();
  });

  test("defaults to the first saved resume when multiple resumes exist", async () => {
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

  test("clicking the selected resume again clears the resume selection", async () => {
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

  test("allows starting an interview when there are no saved resumes", async () => {
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

- [ ] **Step 2: Run setup form tests to verify they fail**

Run:

```bash
pnpm test src/components/interview/__tests__/SetupForm.noResume.test.tsx
```

Expected: FAIL. The first test sends no default resume when multiple resumes exist, the second still sends `resumeId`, and the third start button is disabled without a resume.

- [ ] **Step 3: Implement setup form no-resume behavior**

Modify `src/components/interview/SetupForm.tsx`.

Change the resume load effect from selecting only when there is exactly one resume:

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

Change `handleStart()` so it does not require `selectedResumeId`, and so it omits `resumeId` when no resume is selected:

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

Change the empty resume state copy:

```tsx
          <div className="text-center py-8 border border-white/8 rounded-xl">
            <p className="text-text-muted text-sm mb-3">暂无保存的简历，可直接开始无简历面试</p>
            <Link href="/resumes" className="text-accent text-sm hover:underline font-medium">
              上传简历以获得更个性化的问题
            </Link>
          </div>
```

Change the resume card click handler so clicking the selected card clears it:

```tsx
                onClick={() => setSelectedResumeId((current) => (current === r.id ? null : r.id))}
```

Add a small no-resume hint after the resume selector, below the saved resume list or empty state:

```tsx
        {!loadingResumes && !selectedResumeId && (
          <p className="mt-2 text-xs text-text-muted">未选择简历，将按目标岗位进行通用模拟面试。</p>
        )}
```

Change the start button disabled condition:

```tsx
      <Button onClick={handleStart} loading={loading} disabled={!position}>
        开始面试
      </Button>
```

- [ ] **Step 4: Run setup form tests to verify they pass**

Run:

```bash
pnpm test src/components/interview/__tests__/SetupForm.noResume.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit setup form changes**

Run:

```bash
git add src/components/interview/SetupForm.tsx src/components/interview/__tests__/SetupForm.noResume.test.tsx
git commit -m "feat: allow setup without resume"
```

Expected: commit succeeds.

---

### Task 2: Interview Creation API Without Resume

**Files:**
- Create: `src/app/api/interviews/__tests__/route.test.ts`
- Modify: `src/app/api/interviews/route.ts`

- [ ] **Step 1: Write failing interview creation API tests**

Create `src/app/api/interviews/__tests__/route.test.ts`:

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

  test("creates a no-resume interview when resumeId is omitted", async () => {
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

  test("keeps resume-based creation when resumeId is present", async () => {
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

  test("rejects invalid or unauthorized resumeId", async () => {
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

- [ ] **Step 2: Run interview API tests to verify they fail**

Run:

```bash
pnpm test src/app/api/interviews/__tests__/route.test.ts
```

Expected: FAIL. The no-resume test receives `400` with "简历内容不能为空".

- [ ] **Step 3: Implement no-resume interview creation**

Modify `src/app/api/interviews/route.ts`.

Keep this initialization:

```ts
  const { resumeText, resumeId } = body;
  let { position, questionCount = 12, difficulty = "mid", maxRounds = 2, mode } = body;
  let finalResumeText = resumeText?.trim() ? resumeText : "";
```

Keep the previous-interview branch, preserving empty resume text:

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

Keep the resume lookup only when `resumeId` exists:

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

Remove the old empty-resume guard:

```ts
  if (!finalResumeText) {
    return NextResponse.json({ error: "简历内容不能为空" }, { status: 400 });
  }
```

Replace the opening message content with a branch:

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

- [ ] **Step 4: Run interview API tests to verify they pass**

Run:

```bash
pnpm test src/app/api/interviews/__tests__/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit interview API changes**

Run:

```bash
git add src/app/api/interviews/route.ts src/app/api/interviews/__tests__/route.test.ts
git commit -m "feat: create interviews without resumes"
```

Expected: commit succeeds.

---

### Task 3: DeepSeek Prompt Branching

**Files:**
- Modify: `src/lib/__tests__/deepseek.test.ts`
- Modify: `src/lib/deepseek.ts`

- [ ] **Step 1: Write failing DeepSeek prompt tests**

Modify `src/lib/__tests__/deepseek.test.ts`.

Add these tests inside `describe("buildAggregationMessage", () => { ... })`:

```ts
  test("omits resume suggestions from no-resume aggregation output schema", () => {
    const msg = buildAggregationMessage(questionReviews, "");

    const content = msg.content as string;
    expect(content).not.toContain("resumeSuggestions");
    expect(content).not.toContain("## 候选人简历");
    expect(content).toContain("候选人未提供简历");
    expect(content).toContain("practiceSuggestions");
  });

  test("keeps resume suggestions for resume-based aggregation", () => {
    const msg = buildAggregationMessage(questionReviews, resumeText);

    const content = msg.content as string;
    expect(content).toContain("resumeSuggestions");
    expect(content).toContain("## 候选人简历");
  });
```

Add these tests inside `describe("buildInterviewSystemMessage", () => { ... })`:

```ts
  test("uses no-resume prompt when resume text is empty", () => {
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

  test("keeps resume section when resume text exists", () => {
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

- [ ] **Step 2: Run DeepSeek tests to verify they fail**

Run:

```bash
pnpm test src/lib/__tests__/deepseek.test.ts
```

Expected: FAIL because no-resume prompts still include `## 候选人简历` and `resumeSuggestions`.

- [ ] **Step 3: Implement system prompt branching**

Modify `buildInterviewSystemMessage()` in `src/lib/deepseek.ts`.

Add this near the existing `prevBlock` definition:

```ts
  const hasResume = resumeText.trim().length > 0;
  const resumeContextBlock = hasResume
    ? `## 候选人简历

${resumeText}`
    : `## 面试背景

候选人没有提供简历。请通过候选人的自我介绍和后续回答建立背景，再围绕岗位基础、场景判断、项目经历、沟通表达和问题解决能力继续提问。不要说"根据你的简历"，也不要引用不存在的简历细节。`;
```

Replace the hardcoded resume section in the returned `SystemMessage` string:

```ts
${prevBlock}
---
${resumeContextBlock}

---
## 开场

${startInstruction}`,
```

- [ ] **Step 4: Implement aggregation prompt branching**

Modify `buildAggregationMessage()` in `src/lib/deepseek.ts`.

Add these constants after `annotatedConversation`:

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

Replace the current hardcoded JSON schema and final resume section with:

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

- [ ] **Step 5: Run DeepSeek tests to verify they pass**

Run:

```bash
pnpm test src/lib/__tests__/deepseek.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit DeepSeek prompt changes**

Run:

```bash
git add src/lib/deepseek.ts src/lib/__tests__/deepseek.test.ts
git commit -m "feat: adapt prompts for no-resume interviews"
```

Expected: commit succeeds.

---

### Task 4: Evaluation Persistence For No-Resume Aggregation

**Files:**
- Create: `src/app/api/interviews/[id]/finish/__tests__/route.test.ts`
- Modify: `src/app/api/interviews/[id]/finish/route.ts`

- [ ] **Step 1: Write failing finish-route persistence test**

Create `src/app/api/interviews/[id]/finish/__tests__/route.test.ts`:

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

  test("stores empty resumeSuggestions when aggregation omits resumeSuggestions", async () => {
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

- [ ] **Step 2: Run finish-route test to verify it fails**

Run:

```bash
pnpm test 'src/app/api/interviews/[id]/finish/__tests__/route.test.ts'
```

Expected: FAIL because `resumeSuggestions` is currently created as `undefined` when the aggregation response omits it.

- [ ] **Step 3: Implement empty resume suggestions fallback**

Modify `src/app/api/interviews/[id]/finish/route.ts`.

Change the evaluation creation block from:

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

to:

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

- [ ] **Step 4: Run focused DeepSeek and interview API tests**

Run:

```bash
pnpm test src/lib/__tests__/deepseek.test.ts src/app/api/interviews/__tests__/route.test.ts 'src/app/api/interviews/[id]/finish/__tests__/route.test.ts'
```

Expected: PASS.

- [ ] **Step 5: Commit evaluation persistence change**

Run:

```bash
git add 'src/app/api/interviews/[id]/finish/route.ts' 'src/app/api/interviews/[id]/finish/__tests__/route.test.ts'
git commit -m "fix: persist empty resume suggestions for no-resume evaluations"
```

Expected: commit succeeds.

---

### Task 5: Results UI Hides Resume Suggestions

**Files:**
- Create: `src/components/interview/__tests__/EvaluationText.test.tsx`
- Create: `src/app/results/[id]/__tests__/page.test.tsx`
- Modify: `src/components/interview/EvaluationText.tsx`
- Modify: `src/components/interview/ScoreCard.tsx`
- Modify: `src/app/results/[id]/page.tsx`

- [ ] **Step 1: Write failing EvaluationText tests**

Create `src/components/interview/__tests__/EvaluationText.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { EvaluationText } from "../EvaluationText";

describe("EvaluationText", () => {
  test("shows resume suggestions when requested", () => {
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

  test("hides resume suggestions for no-resume interviews", () => {
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

- [ ] **Step 2: Write failing ResultsPage tests**

Create `src/app/results/[id]/__tests__/page.test.tsx`:

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

describe("ResultsPage no-resume rendering", () => {
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

  test("hides resume suggestions when interview resumeText is empty", () => {
    render(<ResultsPage />);

    expect(screen.queryByText("简历优化建议")).toBeNull();
    expect(screen.queryByText("突出项目指标")).toBeNull();
    expect(screen.getByText("表达清晰")).toBeTruthy();
    expect(screen.getByText("深度不足")).toBeTruthy();
  });

  test("shows resume suggestions when interview has resumeText", () => {
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

- [ ] **Step 3: Run results tests to verify they fail**

Run:

```bash
pnpm test src/components/interview/__tests__/EvaluationText.test.tsx src/app/results/[id]/__tests__/page.test.tsx
```

Expected: FAIL because `EvaluationText` does not accept `showResumeSuggestions` and always renders the resume suggestion block.

- [ ] **Step 4: Implement EvaluationText visibility prop**

Modify `src/components/interview/EvaluationText.tsx`.

Change the function signature:

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

Wrap the resume suggestion block:

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

- [ ] **Step 5: Preserve ScoreCard wrapper behavior**

Modify `src/components/interview/ScoreCard.tsx`.

Change the `EvaluationText` call:

```tsx
      <EvaluationText strengths={strengths} weaknesses={weaknesses} resumeSuggestions={resumeSuggestions} showResumeSuggestions={true} />
```

- [ ] **Step 6: Pass visibility from ResultsPage**

Modify `src/app/results/[id]/page.tsx`.

After:

```tsx
  const { interview, evaluations, messages } = data;
```

add:

```tsx
  const showResumeSuggestions = interview.resumeText.trim().length > 0;
```

Change the partial-evaluation `EvaluationText` call:

```tsx
                <EvaluationText
                  strengths={partialEval.strengths}
                  weaknesses={partialEval.weaknesses}
                  resumeSuggestions={partialEval.resumeSuggestions}
                  roundSummary={partialEval.roundSummary}
                  showResumeSuggestions={showResumeSuggestions}
                />
```

Change the final selected-evaluation `EvaluationText` call:

```tsx
            <EvaluationText
              strengths={selectedEval.strengths}
              weaknesses={selectedEval.weaknesses}
              resumeSuggestions={selectedEval.resumeSuggestions}
              roundSummary={selectedEval.roundSummary}
              showResumeSuggestions={showResumeSuggestions}
            />
```

- [ ] **Step 7: Run results tests to verify they pass**

Run:

```bash
pnpm test src/components/interview/__tests__/EvaluationText.test.tsx src/app/results/[id]/__tests__/page.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit results UI changes**

Run:

```bash
git add src/components/interview/EvaluationText.tsx src/components/interview/ScoreCard.tsx src/components/interview/__tests__/EvaluationText.test.tsx 'src/app/results/[id]/page.tsx' 'src/app/results/[id]/__tests__/page.test.tsx'
git commit -m "feat: hide resume suggestions for no-resume results"
```

Expected: commit succeeds.

---

### Task 6: Full Verification

**Files:**
- No new files.

- [ ] **Step 1: Run all tests**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
pnpm build
```

Expected: PASS.

- [ ] **Step 4: Inspect final diff**

Run:

```bash
git status --short
git log --oneline -6
```

Expected:

- `git status --short` is empty.
- Recent commits include:
  - `feat: allow setup without resume`
  - `feat: create interviews without resumes`
  - `feat: adapt prompts for no-resume interviews`
  - `fix: persist empty resume suggestions for no-resume evaluations`
  - `feat: hide resume suggestions for no-resume results`

## Plan Self-Review

- Spec coverage: setup no-resume entry, API creation, prompt branching, evaluation schema branching, empty resume suggestion persistence, and result UI hiding all have tasks.
- Placeholder scan: no task contains incomplete-marker language or cross-task shorthand.
- Type consistency: `resumeText` remains a string, `resumeId` is omitted rather than sent as `null`, `showResumeSuggestions` is a boolean, and `resumeSuggestions` remains a string for database compatibility.
- Scope: no schema migration, no `contextMode`, no separate API, and no replacement advice section.
