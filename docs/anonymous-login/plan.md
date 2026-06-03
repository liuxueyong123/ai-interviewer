# Anonymous Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one-click anonymous login that creates a normal backend user, signs the existing JWT cookie, and lets the logged-in user set a known password without the old password.

**Architecture:** Implement anonymous login as a new App Router route handler, keep proxy as a lightweight public/protected route gate, and keep anonymous users as regular `User` records with generated username/email/password hash. Update the password route and settings UI so the current logged-in user can set a new password with only `newPassword`.

**Tech Stack:** Next.js 16 App Router Route Handlers, React 19, TypeScript, TypeORM, bcryptjs/JWT helpers, Zod validation, Vitest, Testing Library.

---

## File Structure

- Create `src/app/api/auth/anonymous/route.ts`
  - Owns anonymous user creation, retry behavior, JWT signing, cookie setting, and generic error responses.
- Create `src/app/api/auth/anonymous/__tests__/route.test.ts`
  - Unit-tests anonymous account creation, cookie headers, collision retry, retry exhaustion, and generic error handling with mocked database/auth modules.
- Modify `src/proxy.ts`
  - Export `publicPaths` and add `/api/auth/anonymous`.
- Create `src/__tests__/proxy.test.ts`
  - Unit-tests the public anonymous API path and existing protected API behavior.
- Modify `src/app/api/auth/password/route.ts`
  - Accept only `{ newPassword }`, require current session, hash the new password, and save the current user.
- Create `src/app/api/auth/password/__tests__/route.test.ts`
  - Unit-tests unauthenticated, weak password, successful update, and absence of old password verification.
- Modify `src/app/login/page.tsx`
  - Add anonymous login button, independent loading state, shared error area, and dashboard redirect.
- Create `src/app/login/__tests__/page.test.tsx`
  - Unit-tests anonymous button request, success redirect, and error display.
- Modify `src/app/settings/page.tsx`
  - Remove current password input/state and submit only `{ newPassword }`.
- Create `src/app/settings/__tests__/page.test.tsx`
  - Unit-tests password form payload and weak password blocking.

---

### Task 1: Anonymous Login API

**Files:**
- Create: `src/app/api/auth/anonymous/route.ts`
- Test: `src/app/api/auth/anonymous/__tests__/route.test.ts`

- [ ] **Step 1: Write failing anonymous login API tests**

Create `src/app/api/auth/anonymous/__tests__/route.test.ts`:

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";

type MockUser = {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
};

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  create: vi.fn((data: Omit<MockUser, "id">) => ({ id: 42, ...data })),
  save: vi.fn(async (user: MockUser) => user),
  loggerError: vi.fn(),
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
  signToken: vi.fn((userId: number) => `token-for-${userId}`),
}));

vi.mock("@/lib/database", () => ({
  getDataSource: vi.fn(async () => ({
    getRepository: vi.fn(() => ({
      findOne: mocks.findOne,
      create: mocks.create,
      save: mocks.save,
    })),
  })),
}));

vi.mock("@/entities/User", () => ({
  User: class User {},
}));

vi.mock("@/lib/auth", () => ({
  hashPassword: mocks.hashPassword,
  signToken: mocks.signToken,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

function setRandomValues(values: number[]) {
  const random = vi.spyOn(Math, "random");
  for (const value of values) {
    random.mockReturnValueOnce(value);
  }
  random.mockReturnValue(0.12345);
  return random;
}

describe("POST /api/auth/anonymous", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    process.env.COOKIE_SECURE = "false";
    mocks.findOne.mockResolvedValue(null);
    mocks.create.mockImplementation((data: Omit<MockUser, "id">) => ({ id: 42, ...data }));
    mocks.save.mockImplementation(async (user: MockUser) => user);
    mocks.hashPassword.mockImplementation(async (password: string) => `hashed:${password}`);
    mocks.signToken.mockImplementation((userId: number) => `token-for-${userId}`);
  });

  test("creates a normal user with generated username and anonymous email", async () => {
    setRandomValues([0.48291]);
    const { POST } = await import("../route");

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      token: "token-for-42",
      user: {
        id: 42,
        username: "user48291",
        email: "user48291@anonymous.local",
      },
    });
    expect(mocks.create).toHaveBeenCalledWith({
      username: "user48291",
      email: "user48291@anonymous.local",
      passwordHash: expect.stringMatching(/^hashed:/),
    });
    expect(body.user).not.toHaveProperty("passwordHash");
    expect(body).not.toHaveProperty("password");
  });

  test("sets the same token cookie shape as login and register", async () => {
    setRandomValues([0.55555]);
    const { POST } = await import("../route");

    const response = await POST();
    const setCookie = response.headers.get("set-cookie");

    expect(setCookie).toContain("token=token-for-42");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Max-Age=604800");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=lax");
  });

  test("retries when the generated identity already exists", async () => {
    setRandomValues([0.11111, 0.22222]);
    mocks.findOne.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce(null);
    const { POST } = await import("../route");

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.user.username).toBe("user22222");
    expect(mocks.findOne).toHaveBeenCalledTimes(2);
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });

  test("retries when save fails with a duplicate key error", async () => {
    setRandomValues([0.33333, 0.44444]);
    mocks.save
      .mockRejectedValueOnce(Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY", errno: 1062 }))
      .mockImplementationOnce(async (user: MockUser) => user);
    const { POST } = await import("../route");

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.user.username).toBe("user44444");
    expect(mocks.save).toHaveBeenCalledTimes(2);
  });

  test("returns a generic anonymous creation error after retry exhaustion", async () => {
    setRandomValues([0.10000, 0.10001, 0.10002, 0.10003, 0.10004, 0.10005, 0.10006, 0.10007]);
    mocks.findOne.mockResolvedValue({ id: 1 });
    const { POST } = await import("../route");

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "创建匿名账号失败，请重试" });
    expect(mocks.save).not.toHaveBeenCalled();
  });

  test("returns a generic server error for unexpected failures", async () => {
    setRandomValues([0.77777]);
    mocks.save.mockRejectedValueOnce(new Error("database offline"));
    const { POST } = await import("../route");

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "服务器错误，请稍后重试" });
    expect(mocks.loggerError).toHaveBeenCalledWith("Anonymous login error", { error: "Error: database offline" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test src/app/api/auth/anonymous/__tests__/route.test.ts
```

Expected: FAIL because `src/app/api/auth/anonymous/route.ts` does not exist.

- [ ] **Step 3: Implement anonymous login route**

Create `src/app/api/auth/anonymous/route.ts`:

```ts
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { User } from "@/entities/User";
import { getDataSource } from "@/lib/database";
import { hashPassword, signToken } from "@/lib/auth";
import { logger } from "@/lib/logger";

const MAX_ATTEMPTS = 8;
const ANONYMOUS_EMAIL_DOMAIN = "anonymous.local";

function generateAnonymousUsername(): string {
  const suffix = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
  return `user${suffix}`;
}

function isDuplicateUserError(error: unknown): boolean {
  const candidate = error as { code?: unknown; errno?: unknown; message?: unknown };
  // MySQL-specific duplicate key detection; if the database changes (e.g. PostgreSQL),
  // update this logic to match the new driver's error codes.
  return candidate.code === "ER_DUP_ENTRY" || candidate.errno === 1062 || String(candidate.message || "").includes("Duplicate entry");
}

function createAuthResponse(user: Pick<User, "id" | "username" | "email">): NextResponse {
  const token = signToken(user.id);
  const response = NextResponse.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  response.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const ds = await getDataSource();
    const repo = ds.getRepository(User);

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const username = generateAnonymousUsername();
      const email = `${username}@${ANONYMOUS_EMAIL_DOMAIN}`;

      const existing = await repo.findOne({ where: [{ username }, { email }] });
      if (existing) continue;

      const user = repo.create({
        username,
        email,
        passwordHash: await hashPassword(randomUUID()),
      });

      try {
        const savedUser = await repo.save(user);
        return createAuthResponse(savedUser);
      } catch (error) {
        if (isDuplicateUserError(error)) continue;
        throw error;
      }
    }

    return NextResponse.json({ error: "创建匿名账号失败，请重试" }, { status: 500 });
  } catch (error) {
    logger.error("Anonymous login error", { error: String(error) });
    return NextResponse.json({ error: "服务器错误，请稍后重试" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run anonymous API tests to verify they pass**

Run:

```bash
pnpm test src/app/api/auth/anonymous/__tests__/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit anonymous API**

Run:

```bash
git add src/app/api/auth/anonymous/route.ts src/app/api/auth/anonymous/__tests__/route.test.ts
git commit -m "feat: add anonymous login api"
```

Expected: commit succeeds with only the anonymous route and tests staged.

---

### Task 2: Proxy Public Route Coverage

**Files:**
- Modify: `src/proxy.ts:5`
- Test: `src/__tests__/proxy.test.ts`

- [ ] **Step 1: Write failing proxy tests**

Create `src/__tests__/proxy.test.ts`:

```ts
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { proxy, publicPaths } from "../proxy";

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  verifyToken: mocks.verifyToken,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: mocks.warn,
    info: mocks.info,
  },
  requestDuration: vi.fn(() => ({ durationMs: 1 })),
}));

function request(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

describe("proxy auth gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyToken.mockReturnValue(null);
  });

  test("treats anonymous auth api as public", () => {
    expect(publicPaths).toContain("/api/auth/anonymous");

    const response = proxy(request("/api/auth/anonymous"));

    expect(response.status).toBe(200);
    expect(mocks.verifyToken).not.toHaveBeenCalled();
  });

  test("keeps protected api routes protected without token", async () => {
    const response = proxy(request("/api/resumes"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "未登录" });
    expect(mocks.warn).toHaveBeenCalledWith("Unauthenticated API request", { method: "GET", path: "/api/resumes" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test src/__tests__/proxy.test.ts
```

Expected: FAIL because `publicPaths` is not exported and `/api/auth/anonymous` is not public.

- [ ] **Step 3: Update proxy public paths**

Modify `src/proxy.ts` line 5:

```ts
export const publicPaths = [
  "/login",
  "/register",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/anonymous",
];
```

Leave the rest of `src/proxy.ts` unchanged.

- [ ] **Step 4: Run proxy tests**

Run:

```bash
pnpm test src/__tests__/proxy.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit proxy update**

Run:

```bash
git add src/proxy.ts src/__tests__/proxy.test.ts
git commit -m "test: cover anonymous auth proxy access"
```

Expected: commit succeeds with proxy path and tests staged.

---

### Task 3: Password API Without Current Password

**Files:**
- Modify: `src/app/api/auth/password/route.ts:1-38`
- Test: `src/app/api/auth/password/__tests__/route.test.ts`

- [ ] **Step 1: Write failing password API tests**

Create `src/app/api/auth/password/__tests__/route.test.ts`:

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  findOne: vi.fn(),
  update: vi.fn(async () => ({ affected: 1 })),
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
  verifyPassword: vi.fn(),
}));

vi.mock("@/lib/utils", () => ({
  getUserId: mocks.getUserId,
}));

vi.mock("@/lib/database", () => ({
  getDataSource: vi.fn(async () => ({
    getRepository: vi.fn(() => ({
      findOne: mocks.findOne,
      update: mocks.update,
    })),
  })),
}));

vi.mock("@/entities/User", () => ({
  User: class User {},
}));

vi.mock("@/lib/auth", () => ({
  hashPassword: mocks.hashPassword,
  verifyPassword: mocks.verifyPassword,
}));

function request(body: unknown) {
  return {
    json: async () => body,
    headers: new Headers(),
  } as never;
}

describe("PATCH /api/auth/password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserId.mockReturnValue(7);
    mocks.findOne.mockResolvedValue({ id: 7, passwordHash: "old-hash" });
    mocks.update.mockImplementation(async () => ({ affected: 1 }));
    mocks.hashPassword.mockImplementation(async (password: string) => `hashed:${password}`);
  });

  test("rejects unauthenticated requests", async () => {
    mocks.getUserId.mockReturnValue(0);
    const { PATCH } = await import("../route");

    const response = await PATCH(request({ newPassword: "StrongPass1" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "未登录" });
  });

  test("rejects weak new passwords", async () => {
    const { PATCH } = await import("../route");

    const response = await PATCH(request({ newPassword: "123" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("新密码至少8位");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  test("updates the current user password without currentPassword", async () => {
    const user = { id: 7, passwordHash: "old-hash" };
    mocks.findOne.mockResolvedValue(user);
    const { PATCH } = await import("../route");

    const response = await PATCH(request({ newPassword: "StrongPass1" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mocks.findOne).toHaveBeenCalledWith({ where: { id: 7 } });
    expect(mocks.hashPassword).toHaveBeenCalledWith("StrongPass1");
    expect(mocks.update).toHaveBeenCalledWith(7, { passwordHash: "hashed:StrongPass1" });
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
  });

  test("returns 404 if the session user no longer exists", async () => {
    mocks.findOne.mockResolvedValue(null);
    const { PATCH } = await import("../route");

    const response = await PATCH(request({ newPassword: "StrongPass1" }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "用户不存在" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test src/app/api/auth/password/__tests__/route.test.ts
```

Expected: FAIL because the current route requires `currentPassword` and calls `verifyPassword`.

- [ ] **Step 3: Replace password route implementation**

Replace `src/app/api/auth/password/route.ts` with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { User } from "@/entities/User";
import { getUserId } from "@/lib/utils";
import { hashPassword } from "@/lib/auth";
import { validate, ValidationError, passwordRefinement } from "@/lib/validations";
import { z } from "zod";

const setPasswordSchema = z.object({
  newPassword: z.string().min(8, "新密码至少8位").superRefine(passwordRefinement),
});

export async function PATCH(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body: { newPassword: string };
  try {
    body = validate(setPasswordSchema, await request.json());
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  const ds = await getDataSource();
  const repo = ds.getRepository(User);
  const user = await repo.findOne({ where: { id: userId } });

  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  // Use repo.update() instead of spread+save to avoid losing the TypeORM entity prototype.
  await repo.update(userId, { passwordHash: await hashPassword(body.newPassword) });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run password API tests**

Run:

```bash
pnpm test src/app/api/auth/password/__tests__/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit password API change**

Run:

```bash
git add src/app/api/auth/password/route.ts src/app/api/auth/password/__tests__/route.test.ts
git commit -m "feat: allow setting password from active session"
```

Expected: commit succeeds with password route and tests staged.

---

### Task 4: Login Page Anonymous Entry Point

**Files:**
- Modify: `src/app/login/page.tsx:1-102`
- Test: `src/app/login/__tests__/page.test.tsx`

- [ ] **Step 1: Write failing login page tests**

Create `src/app/login/__tests__/page.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import LoginPage from "../page";

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

describe("LoginPage anonymous login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  test("creates an anonymous session and redirects to dashboard", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: { id: 1, username: "user12345", email: "user12345@anonymous.local" } }),
    } as Response);

    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "一键体验" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/auth/anonymous", { method: "POST" });
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  test("shows backend error when anonymous login fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "创建匿名账号失败，请重试" }),
    } as Response);

    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "一键体验" }));

    expect(await screen.findByText("创建匿名账号失败，请重试")).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test src/app/login/__tests__/page.test.tsx
```

Expected: FAIL because the login page has no anonymous login button.

- [ ] **Step 3: Add anonymous login state and handler**

Modify `src/app/login/page.tsx`:

At the state block near lines 10-14, add:

```tsx
const [anonymousLoading, setAnonymousLoading] = useState(false);
```

After `handleSubmit`, add:

```tsx
async function handleAnonymousLogin() {
  setError("");
  setAnonymousLoading(true);

  const res = await fetch("/api/auth/anonymous", {
    method: "POST",
  });

  const data = await res.json();
  setAnonymousLoading(false);

  if (!res.ok) {
    setError(data.error);
    return;
  }

  router.push("/dashboard");
}
```

Update the existing submit button around lines 88-91:

```tsx
<button type="submit" disabled={loading || anonymousLoading}
  className="w-full py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50 transition-all duration-200 font-display cursor-pointer">
  {loading ? "登录中..." : "登录"}
</button>
<button type="button" onClick={handleAnonymousLogin} disabled={loading || anonymousLoading}
  className="w-full py-3 bg-surface-0 border border-border text-text-primary font-semibold rounded-xl hover:border-accent hover:text-accent active:scale-[0.98] disabled:opacity-50 transition-all duration-200 font-display cursor-pointer">
  {anonymousLoading ? "正在创建体验账号..." : "一键体验"}
</button>
```

- [ ] **Step 4: Run login page tests**

Run:

```bash
pnpm test src/app/login/__tests__/page.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit login UI change**

Run:

```bash
git add src/app/login/page.tsx src/app/login/__tests__/page.test.tsx
git commit -m "feat: add anonymous login entry point"
```

Expected: commit succeeds with login page and tests staged.

---

### Task 5: Settings Password Form Update

**Files:**
- Modify: `src/app/settings/page.tsx:1-320`
- Test: `src/app/settings/__tests__/page.test.tsx`

- [ ] **Step 1: Write failing settings page tests**

Create `src/app/settings/__tests__/page.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import SettingsPage from "../page";

describe("SettingsPage password form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/users/me") {
        return {
          ok: true,
          json: async () => ({ username: "user12345", email: "user12345@anonymous.local" }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ success: true }),
      } as Response;
    });
  });

  test("sends only newPassword when setting password", async () => {
    render(<SettingsPage />);

    fireEvent.change(screen.getByPlaceholderText("至少8位，含两种字符类型"), { target: { value: "StrongPass1" } });
    fireEvent.click(screen.getByRole("button", { name: "设置新密码" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: "StrongPass1" }),
      });
    });
  });

  test("does not render current password input", () => {
    render(<SettingsPage />);

    expect(screen.queryByPlaceholderText("输入当前密码")).toBeNull();
  });

  test("blocks weak password before calling password api", async () => {
    render(<SettingsPage />);

    fireEvent.change(screen.getByPlaceholderText("至少8位，含两种字符类型"), { target: { value: "12345678" } });
    fireEvent.click(screen.getByRole("button", { name: "设置新密码" }));

    expect(await screen.findByText("密码需包含数字、小写字母、大写字母、符号中的至少两种")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalledWith("/api/auth/password", expect.anything());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test src/app/settings/__tests__/page.test.tsx
```

Expected: FAIL because the settings page still renders `当前密码` and sends `currentPassword`.

- [ ] **Step 3: Remove current password state and payload**

Modify `src/app/settings/page.tsx`:

Remove these state declarations:

```tsx
const [currentPassword, setCurrentPassword] = useState("");
const [showCurrentPassword, setShowCurrentPassword] = useState(false);
```

Change the password submit payload from:

```tsx
body: JSON.stringify({ currentPassword, newPassword }),
```

to:

```tsx
body: JSON.stringify({ newPassword }),
```

Remove this success reset:

```tsx
setCurrentPassword("");
```

- [ ] **Step 4: Remove current password input and update copy**

Modify the password card in `src/app/settings/page.tsx`:

Change:

```tsx
<h2 className="font-display font-semibold text-text-primary">修改密码</h2>
```

to:

```tsx
<h2 className="font-display font-semibold text-text-primary">设置新密码</h2>
```

Delete the entire current password field block that starts with:

```tsx
<div>
  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">当前密码</label>
```

and ends at the matching closing `</div>` before the new password field.

Change the final button idle text from:

```tsx
"修改密码"
```

to:

```tsx
"设置新密码"
```

Keep the loading text `设置中...` and success text `已设置`.

- [ ] **Step 5: Run settings tests**

Run:

```bash
pnpm test src/app/settings/__tests__/page.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit settings UI change**

Run:

```bash
git add src/app/settings/page.tsx src/app/settings/__tests__/page.test.tsx
git commit -m "feat: simplify password settings form"
```

Expected: commit succeeds with settings page and tests staged.

---

### Task 6: Full Verification

**Files:**
- Verify all changed files from Tasks 1-5.

- [ ] **Step 1: Run focused auth tests**

Run:

```bash
pnpm test src/app/api/auth/anonymous/__tests__/route.test.ts src/app/api/auth/password/__tests__/route.test.ts src/__tests__/proxy.test.ts src/app/login/__tests__/page.test.tsx src/app/settings/__tests__/page.test.tsx
```

Expected: PASS for all focused anonymous login and password-setting tests.

- [ ] **Step 2: Run full test suite**

Run:

```bash
pnpm test
```

Expected: PASS for all Vitest tests.

- [ ] **Step 3: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS with no ESLint errors.

- [ ] **Step 4: Run production build**

Run:

```bash
pnpm build
```

Expected: PASS with a successful Next.js build.

- [ ] **Step 5: Review final diff**

Run:

```bash
git diff --stat HEAD~5..HEAD
git diff HEAD~5..HEAD -- src/app/api/auth/anonymous/route.ts src/app/api/auth/password/route.ts src/proxy.ts src/app/login/page.tsx src/app/settings/page.tsx
```

Expected: Diff includes only anonymous login API, proxy public path, password route simplification, login entry point, settings form simplification, and related tests.

- [ ] **Step 6: Final integration commit if needed**

If any verification-only fixes were made after Task 5, commit them:

```bash
git add src docs
git commit -m "fix: complete anonymous login verification"
```

Expected: No commit is needed if Tasks 1-5 already produced a clean verified state.
