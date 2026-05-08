# InterviewAI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack AI interview practice platform where users upload PDF resumes, AI conducts technical interviews, and generates scored evaluations.

**Architecture:** Next.js 15 App Router with API Routes as BFF. MySQL + TypeORM for persistence. JWT auth via middleware. DeepSeek V4 Pro for AI conversation and evaluation. PDF parsing server-side via pdf-parse.

**Tech Stack:** Next.js 15, Tailwind CSS v4, TypeORM, MySQL, JWT + bcrypt, DeepSeek V4 Pro, pdf-parse

---

## File Structure

```
project/
├── .env.local
├── package.json
├── tsconfig.json
├── next.config.ts
├── src/
│   ├── middleware.ts                    # JWT auth middleware
│   ├── app/
│   │   ├── layout.tsx                  # Root layout + providers
│   │   ├── page.tsx                    # Redirect to /dashboard
│   │   ├── globals.css                 # Tailwind + tokens
│   │   ├── login/page.tsx              # Login form
│   │   ├── register/page.tsx           # Register form
│   │   ├── dashboard/page.tsx          # Interview history list
│   │   ├── interview/
│   │   │   ├── setup/page.tsx          # Position select + PDF upload
│   │   │   └── chat/page.tsx           # AI chat interview
│   │   ├── results/[id]/page.tsx       # Evaluation report
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── register/route.ts
│   │       │   └── login/route.ts
│   │       ├── pdf/route.ts
│   │       ├── chat/route.ts
│   │       └── interviews/
│   │           ├── route.ts            # GET list + POST create
│   │           └── [id]/
│   │               ├── route.ts        # GET detail
│   │               └── finish/route.ts # POST trigger evaluation
│   ├── entities/
│   │   ├── User.ts
│   │   ├── Interview.ts
│   │   ├── Message.ts
│   │   └── Evaluation.ts
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── database.ts
│   │   ├── deepseek.ts
│   │   └── pdf.ts
│   └── components/
│       ├── chat/
│       │   ├── ChatContainer.tsx
│       │   └── ChatMessage.tsx
│       ├── interview/
│       │   ├── SetupForm.tsx
│       │   └── ScoreCard.tsx
│       └── Button.tsx
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `.env.local`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /Users/lxy/Documents/meeting && npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --turbopack
```

Expected: Project files created, `package.json` populated

- [ ] **Step 2: Install additional dependencies**

```bash
npm install typeorm mysql2 reflect-metadata bcryptjs jsonwebtoken pdf-parse
npm install -D @types/bcryptjs @types/jsonwebtoken @types/pdf-parse
```

- [ ] **Step 3: Create .env.local**

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=interview_ai
JWT_SECRET=dev-secret-change-in-production
DEEPSEEK_API_KEY=sk-your-key-here
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

- [ ] **Step 4: Configure TypeORM in tsconfig.json — add decorator support**

Read `tsconfig.json`, then edit to add `experimentalDecorators: true` and `emitDecoratorMetadata: true` under `compilerOptions`.

- [ ] **Step 5: Write src/app/globals.css with Tailwind directives**

```css
@import "tailwindcss";

:root {
  --color-surface: #ffffff;
  --color-bg: #f8f9fa;
  --color-text: #1a1a2e;
  --color-text-muted: #6b7280;
  --color-accent: #4f46e5;
  --color-border: #e5e7eb;
  --color-success: #10b981;
  --color-warning: #f59e0b;
}

body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 6: Write minimal src/app/layout.tsx**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InterviewAI - AI模拟面试",
  description: "专业AI模拟面试练习平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Verify project builds**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 8: Commit**

```bash
git init && git add -A && git commit -m "chore: scaffold Next.js project with dependencies"
```

---

### Task 2: Database Connection + Entities

**Files:**
- Create: `src/lib/database.ts`, `src/entities/User.ts`, `src/entities/Interview.ts`, `src/entities/Message.ts`, `src/entities/Evaluation.ts`

- [ ] **Step 1: Write TypeORM DataSource — src/lib/database.ts**

```typescript
import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "@/entities/User";
import { Interview } from "@/entities/Interview";
import { Message } from "@/entities/Message";
import { Evaluation } from "@/entities/Evaluation";

export const AppDataSource = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  username: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "interview_ai",
  synchronize: true,
  logging: false,
  entities: [User, Interview, Message, Evaluation],
});

let initialized = false;

export async function getDataSource(): Promise<DataSource> {
  if (!initialized) {
    await AppDataSource.initialize();
    initialized = true;
  }
  return AppDataSource;
}
```

- [ ] **Step 2: Write User entity — src/entities/User.ts**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from "typeorm";
import { Interview } from "./Interview";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 50, unique: true })
  username: string;

  @Column({ type: "varchar", length: 255, unique: true })
  email: string;

  @Column({ type: "varchar", length: 255, name: "password_hash" })
  passwordHash: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @OneToMany(() => Interview, (interview) => interview.user)
  interviews: Interview[];
}
```

- [ ] **Step 3: Write Interview entity — src/entities/Interview.ts**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, OneToOne, JoinColumn } from "typeorm";
import { User } from "./User";
import { Message } from "./Message";
import { Evaluation } from "./Evaluation";

@Entity()
export class Interview {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.interviews, { nullable: false })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ type: "varchar", length: 100 })
  position: string;

  @Column({ type: "text", name: "resume_text" })
  resumeText: string;

  @Column({ type: "enum", enum: ["ongoing", "done"], default: "ongoing" })
  status: "ongoing" | "done";

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @OneToMany(() => Message, (message) => message.interview)
  messages: Message[];

  @OneToOne(() => Evaluation, (evaluation) => evaluation.interview)
  evaluation: Evaluation;
}
```

- [ ] **Step 4: Write Message entity — src/entities/Message.ts**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Interview } from "./Interview";

@Entity()
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Interview, (interview) => interview.messages, { nullable: false })
  @JoinColumn({ name: "interview_id" })
  interview: Interview;

  @Column({ type: "enum", enum: ["interviewer", "user"] })
  role: "interviewer" | "user";

  @Column({ type: "text" })
  content: string;

  @Column({ type: "int", name: "question_number", nullable: true })
  questionNumber: number | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
```

- [ ] **Step 5: Write Evaluation entity — src/entities/Evaluation.ts**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToOne, JoinColumn } from "typeorm";
import { Interview } from "./Interview";

@Entity()
export class Evaluation {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Interview, (interview) => interview.evaluation, { nullable: false })
  @JoinColumn({ name: "interview_id" })
  interview: Interview;

  @Column({ type: "int", name: "overall_score" })
  overallScore: number;

  @Column({ type: "json" })
  categories: { tech: number; project: number; softSkills: number };

  @Column({ type: "text" })
  strengths: string;

  @Column({ type: "text" })
  weaknesses: string;

  @Column({ type: "text", name: "resume_suggestions" })
  resumeSuggestions: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add database connection and entity definitions"
```

---

### Task 3: Auth Library + API Routes + Middleware

**Files:**
- Create: `src/lib/auth.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/auth/login/route.ts`, `src/middleware.ts`

- [ ] **Step 1: Write auth lib — src/lib/auth.ts**

```typescript
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function signToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { userId: number } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Write register API — src/app/api/auth/register/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { User } from "@/entities/User";
import { hashPassword, signToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { username, email, password } = await request.json();

  if (!username || !email || !password) {
    return NextResponse.json({ error: "所有字段必填" }, { status: 400 });
  }

  const ds = await getDataSource();
  const repo = ds.getRepository(User);

  const existing = await repo.findOne({ where: [{ username }, { email }] });
  if (existing) {
    return NextResponse.json({ error: "用户名或邮箱已被注册" }, { status: 409 });
  }

  const user = repo.create({
    username,
    email,
    passwordHash: hashPassword(password),
  });
  await repo.save(user);

  const token = signToken(user.id);
  return NextResponse.json({ token, user: { id: user.id, username: user.username, email: user.email } });
}
```

- [ ] **Step 3: Write login API — src/app/api/auth/login/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { User } from "@/entities/User";
import { verifyPassword, signToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: "用户名和密码必填" }, { status: 400 });
  }

  const ds = await getDataSource();
  const repo = ds.getRepository(User);

  const user = await repo.findOne({ where: { username } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
  }

  const token = signToken(user.id);
  return NextResponse.json({ token, user: { id: user.id, username: user.username, email: user.email } });
}
```

- [ ] **Step 4: Write auth middleware — src/middleware.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

const publicPaths = ["/login", "/register", "/api/auth/login", "/api/auth/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("token")?.value;
  if (!token || !verifyToken(token)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add auth system with JWT + bcrypt"
```

---

### Task 4: Login & Register Pages

**Files:**
- Create: `src/app/login/page.tsx`, `src/app/register/page.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Write login page — src/app/login/page.tsx**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    document.cookie = `token=${data.token}; path=/; max-age=${60 * 60 * 24 * 7}`;
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-8">InterviewAI</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          没有账号？<Link href="/register" className="text-indigo-600 hover:underline">注册</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write register page — src/app/register/page.tsx**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    document.cookie = `token=${data.token}; path=/; max-age=${60 * 60 * 24 * 7}`;
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-8">InterviewAI</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "注册中..." : "注册"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          已有账号？<Link href="/login" className="text-indigo-600 hover:underline">登录</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write root page redirect — src/app/page.tsx**

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add login and register pages"
```

---

### Task 5: PDF Upload API

**Files:**
- Create: `src/lib/pdf.ts`, `src/app/api/pdf/route.ts`

- [ ] **Step 1: Write PDF parsing lib — src/lib/pdf.ts**

```typescript
import pdfParse from "pdf-parse";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  if (buffer.length > MAX_SIZE) {
    throw new Error("PDF文件大小不能超过5MB");
  }
  const data = await pdfParse(buffer);
  return data.text;
}
```

- [ ] **Step 2: Write PDF upload API — src/app/api/pdf/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { parsePdfBuffer } from "@/lib/pdf";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "请上传PDF文件" }, { status: 400 });
    }

    if (!file.name.endsWith(".pdf")) {
      return NextResponse.json({ error: "仅支持PDF格式" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await parsePdfBuffer(buffer);

    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "解析失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add PDF upload and parsing API"
```

---

### Task 6: DeepSeek AI Client

**Files:**
- Create: `src/lib/deepseek.ts`

- [ ] **Step 1: Write DeepSeek client — src/lib/deepseek.ts**

```typescript
const API_KEY = process.env.DEEPSEEK_API_KEY || "";
const BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function chat(messages: ChatMessage[]): Promise<string> {
  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-v4-pro",
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    throw new Error(`DeepSeek API error: ${res.status}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

export function buildInterviewSystemPrompt(position: string, resumeText: string, questionCount: number = 12): string {
  return `你是 ${position} 的技术面试官。请严格遵守以下规则：

规则：
1. 每次只提一个问题，等待回答后再提下一个
2. 问题覆盖技术深度、项目经验、行为面试三个维度（比例约 45%/45%/10%）
3. 根据回答质量动态调整难度
4. 不评价回答，保持中立
5. 共提问约 ${questionCount} 个问题

候选人简历：${resumeText}

开始面试：先简短自我介绍，然后提第一个问题。`;
}

export function buildEvaluationPrompt(conversationHistory: string, resumeText: string): string {
  return `请根据以下面试对话，对候选人进行评分。输出纯 JSON 格式（不要 markdown 代码块）：

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

面试记录：
${conversationHistory}

候选人简历：${resumeText}`;
}

export async function sendInterviewMessage(messages: ChatMessage[]): Promise<string> {
  return chat(messages);
}

export async function getEvaluation(messages: ChatMessage[]): Promise<string> {
  return chat(messages);
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add DeepSeek AI client"
```

---

### Task 7: Interview Setup Page

**Files:**
- Create: `src/app/interview/setup/page.tsx`, `src/components/Button.tsx`, `src/components/interview/SetupForm.tsx`

- [ ] **Step 1: Write Button component — src/components/Button.tsx**

```tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export default function Button({ children, loading, disabled, className = "", ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors ${className}`}
      {...props}
    >
      {loading ? "处理中..." : children}
    </button>
  );
}
```

- [ ] **Step 2: Write SetupForm component — src/components/interview/SetupForm.tsx**

```tsx
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";

const POSITIONS = [
  "前端开发工程师",
  "后端开发工程师",
  "全栈开发工程师",
  "iOS开发工程师",
  "Android开发工程师",
  "数据工程师",
  "DevOps工程师",
  "AI/ML工程师",
];

export default function SetupForm() {
  const router = useRouter();
  const [position, setPosition] = useState(POSITIONS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) return;
    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/pdf", { method: "POST", body: formData });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }
    setResumeText(data.text);
  }

  async function handleStart() {
    if (!resumeText) {
      setError("请先上传简历");
      return;
    }
    setLoading(true);

    const res = await fetch("/api/interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position, resumeText }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    router.push(`/interview/chat?id=${data.interviewId}`);
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <label className="block text-sm font-medium mb-1">目标岗位</label>
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {POSITIONS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">上传简历 (PDF)</label>
        <div
          onClick={() => fileRef.current?.click()}
          className={`w-full h-32 border-2 border-dashed rounded-xl flex items-center justify-center cursor-pointer transition-colors ${file ? "border-green-400 bg-green-50" : "border-gray-300 hover:border-indigo-400"}`}
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => { setFile(e.target.files?.[0] || null); setResumeText(""); }}
          />
          <span className="text-sm text-gray-500">
            {file ? `📄 ${file.name}` : "点击选择 PDF 文件"}
          </span>
        </div>
      </div>

      {file && !resumeText && (
        <Button onClick={handleUpload} loading={loading}>
          解析简历
        </Button>
      )}

      {resumeText && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700">简历解析成功（{resumeText.length} 字符）</p>
        </div>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <Button onClick={handleStart} loading={loading} disabled={!resumeText}>
        开始面试
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Write interview setup page — src/app/interview/setup/page.tsx**

```tsx
import SetupForm from "@/components/interview/SetupForm";

export default function InterviewSetupPage() {
  return (
    <div className="max-w-lg mx-auto py-16 px-4">
      <h1 className="text-2xl font-bold text-center mb-2">开始面试</h1>
      <p className="text-center text-gray-500 mb-8">选择目标岗位并上传简历，AI 将为你模拟专业面试</p>
      <SetupForm />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add interview setup page with PDF upload"
```

---

### Task 8: Chat API + Interviews API

**Files:**
- Create: `src/app/api/chat/route.ts`, `src/app/api/interviews/route.ts`, `src/app/api/interviews/[id]/route.ts`, `src/app/api/interviews/[id]/finish/route.ts`

- [ ] **Step 1: Write POST /api/interviews (create) + GET /api/interviews (list) — src/app/api/interviews/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Interview } from "@/entities/Interview";
import { verifyToken } from "@/lib/auth";

function getUserId(request: NextRequest): number | null {
  const token = request.cookies.get("token")?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

export async function GET(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const ds = await getDataSource();
  const interviews = await ds.getRepository(Interview).find({
    where: { user: { id: userId } },
    order: { createdAt: "DESC" },
    relations: ["evaluation"],
  });

  return NextResponse.json(
    interviews.map((i) => ({
      id: i.id,
      position: i.position,
      status: i.status,
      overallScore: i.evaluation?.overallScore ?? null,
      createdAt: i.createdAt,
    }))
  );
}

export async function POST(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { position, resumeText } = await request.json();
  if (!position || !resumeText) {
    return NextResponse.json({ error: "岗位和简历不能为空" }, { status: 400 });
  }

  const ds = await getDataSource();
  const interview = ds.getRepository(Interview).create({
    user: { id: userId },
    position,
    resumeText,
    status: "ongoing",
  });
  await ds.getRepository(Interview).save(interview);

  return NextResponse.json({ interviewId: interview.id });
}
```

- [ ] **Step 2: Write GET /api/interviews/[id] — src/app/api/interviews/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Interview } from "@/entities/Interview";
import { verifyToken } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("token")?.value;
  if (!token) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const ds = await getDataSource();
  const { id } = await params;
  const interview = await ds.getRepository(Interview).findOne({
    where: { id: parseInt(id), user: { id: payload.userId } },
    relations: ["messages", "evaluation"],
  });

  if (!interview) {
    return NextResponse.json({ error: "面试不存在" }, { status: 404 });
  }

  return NextResponse.json({
    interview: {
      id: interview.id,
      position: interview.position,
      status: interview.status,
      createdAt: interview.createdAt,
    },
    messages: interview.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      questionNumber: m.questionNumber,
      createdAt: m.createdAt,
    })),
    evaluation: interview.evaluation
      ? {
          overallScore: interview.evaluation.overallScore,
          categories: interview.evaluation.categories,
          strengths: interview.evaluation.strengths,
          weaknesses: interview.evaluation.weaknesses,
          resumeSuggestions: interview.evaluation.resumeSuggestions,
        }
      : null,
  });
}
```

- [ ] **Step 3: Write POST /api/chat — src/app/api/chat/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Interview } from "@/entities/Interview";
import { Message } from "@/entities/Message";
import { verifyToken } from "@/lib/auth";
import { buildInterviewSystemPrompt, sendInterviewMessage } from "@/lib/deepseek";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  if (!token) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { interviewId, message } = await request.json();
  if (!interviewId || !message) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }

  const ds = await getDataSource();
  const interview = await ds.getRepository(Interview).findOne({
    where: { id: interviewId, user: { id: payload.userId } },
    relations: ["messages"],
  });

  if (!interview) return NextResponse.json({ error: "面试不存在" }, { status: 404 });
  if (interview.status === "done") return NextResponse.json({ error: "面试已结束" }, { status: 400 });

  const msgRepo = ds.getRepository(Message);

  // Save user message
  const userMsg = msgRepo.create({
    interview: { id: interviewId },
    role: "user",
    content: message,
    questionNumber: null,
  });
  await msgRepo.save(userMsg);

  // Count existing interviewer questions
  const questionCount = await msgRepo.count({
    where: { interview: { id: interviewId }, role: "interviewer" },
  });

  const isFirstMessage = questionCount === 0;

  // Build message history for AI
  const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];

  if (isFirstMessage) {
    chatMessages.push({
      role: "system",
      content: buildInterviewSystemPrompt(interview.position, interview.resumeText),
    });
  } else {
    // Load conversation history
    const history = await msgRepo.find({
      where: { interview: { id: interviewId } },
      order: { createdAt: "ASC" },
    });

    const historyText = history
      .map((m) => `${m.role === "interviewer" ? "面试官" : "候选人"}：${m.content}`)
      .join("\n\n");

    chatMessages.push({
      role: "system",
      content: `${buildInterviewSystemPrompt(interview.position, interview.resumeText)}\n\n以下是已经进行的对话：\n${historyText}\n\n请根据以上对话继续提出下一个问题。`,
    });
  }

  chatMessages.push({ role: "user", content: message });

  try {
    const reply = await sendInterviewMessage(chatMessages);

    const newCount = questionCount + 1;
    const interviewerMsg = msgRepo.create({
      interview: { id: interviewId },
      role: "interviewer",
      content: reply,
      questionNumber: newCount,
    });
    await msgRepo.save(interviewerMsg);

    // Auto-finish if question limit reached
    if (newCount >= 12) {
      interview.status = "done";
      await ds.getRepository(Interview).save(interview);
    }

    return NextResponse.json({
      reply,
      questionNumber: newCount,
      isFinished: interview.status === "done",
    });
  } catch (error) {
    return NextResponse.json({ error: "AI响应失败，请重试" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Write POST /api/interviews/[id]/finish — src/app/api/interviews/[id]/finish/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Interview } from "@/entities/Interview";
import { Message } from "@/entities/Message";
import { Evaluation } from "@/entities/Evaluation";
import { verifyToken } from "@/lib/auth";
import { buildEvaluationPrompt, getEvaluation } from "@/lib/deepseek";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("token")?.value;
  if (!token) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const ds = await getDataSource();
  const { id } = await params;
  const interview = await ds.getRepository(Interview).findOne({
    where: { id: parseInt(id), user: { id: payload.userId } },
    relations: ["messages"],
  });

  if (!interview) return NextResponse.json({ error: "面试不存在" }, { status: 404 });
  if (interview.status === "done") return NextResponse.json({ error: "面试已结束" }, { status: 400 });

  // Build conversation history text
  const conversationHistory = interview.messages
    .map((m) => `${m.role === "interviewer" ? "面试官" : "候选人"}：${m.content}`)
    .join("\n\n");

  const evalResult = await getEvaluation([
    { role: "user", content: buildEvaluationPrompt(conversationHistory, interview.resumeText) },
  ]);

  // Parse the JSON response — strip potential markdown code fences
  const jsonStr = evalResult.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(jsonStr);

  const evaluation = ds.getRepository(Evaluation).create({
    interview: { id: interview.id },
    overallScore: parsed.overallScore,
    categories: parsed.categories,
    strengths: parsed.strengths,
    weaknesses: parsed.weaknesses,
    resumeSuggestions: parsed.resumeSuggestions,
  });
  await ds.getRepository(Evaluation).save(evaluation);

  interview.status = "done";
  await ds.getRepository(Interview).save(interview);

  return NextResponse.json({ evaluation: parsed });
}
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add chat API, interviews CRUD, and evaluation endpoint"
```

---

### Task 9: Chat Page (Core Interview UI)

**Files:**
- Create: `src/components/chat/ChatMessage.tsx`, `src/components/chat/ChatContainer.tsx`, `src/app/interview/chat/page.tsx`

- [ ] **Step 1: Write ChatMessage component — src/components/chat/ChatMessage.tsx**

```tsx
interface ChatMessageProps {
  role: "interviewer" | "user";
  content: string;
}

export default function ChatMessage({ role, content }: ChatMessageProps) {
  const isInterviewer = role === "interviewer";

  return (
    <div className={`flex ${isInterviewer ? "justify-start" : "justify-end"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${isInterviewer ? "bg-white border border-gray-200 text-gray-800" : "bg-indigo-600 text-white"}`}
      >
        {isInterviewer && <span className="text-xs font-medium text-indigo-500 block mb-1">面试官</span>}
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write ChatContainer component — src/components/chat/ChatContainer.tsx**

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ChatMessage from "./ChatMessage";

interface Message {
  id: number;
  role: "interviewer" | "user";
  content: string;
  questionNumber: number | null;
}

export default function ChatContainer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const interviewId = searchParams.get("id");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || loading || !interviewId) return;

    const userMsg = input.trim();
    setInput("");
    setError("");

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: "user", content: userMsg, questionNumber: null },
    ]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId: parseInt(interviewId), message: userMsg }),
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error || "发送失败");
        return;
      }

      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "interviewer", content: data.reply, questionNumber: data.questionNumber },
      ]);

      if (data.isFinished) {
        setFinished(true);
      }
    } catch {
      setLoading(false);
      setError("网络错误，请重试");
    }
  }

  async function finishInterview() {
    if (!interviewId || finished) return;
    setLoading(true);

    const res = await fetch(`/api/interviews/${interviewId}/finish`, { method: "POST" });
    setLoading(false);

    if (res.ok) {
      router.push(`/results/${interviewId}`);
    } else {
      setError("结束面试失败，请重试");
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <h1 className="font-semibold text-sm">AI 面试进行中</h1>
        <span className="text-xs text-gray-400">
          问题 {messages.filter((m) => m.role === "interviewer").length} / 12
        </span>
        <button
          onClick={finishInterview}
          disabled={loading || finished}
          className="text-xs px-3 py-1 bg-red-50 text-red-600 rounded-full hover:bg-red-100 disabled:opacity-50 transition-colors"
        >
          结束面试
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && !loading && (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-lg mb-2">面试即将开始</p>
            <p className="text-sm">AI 面试官正在准备第一个问题...</p>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
        ))}
        {loading && (
          <div className="flex justify-start mb-4">
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
              <span className="text-xs text-indigo-500">面试官</span>
              <div className="flex gap-1 mt-2">
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
        {finished && (
          <div className="text-center mt-4">
            <p className="text-green-600 text-sm mb-2">面试已完成</p>
            <button
              onClick={() => router.push(`/results/${interviewId}`)}
              className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              查看评分报告
            </button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {!finished && (
        <div className="border-t border-gray-200 bg-white px-4 py-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
              placeholder="输入你的回答..."
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              发送
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write chat page — src/app/interview/chat/page.tsx**

```tsx
import { Suspense } from "react";
import ChatContainer from "@/components/chat/ChatContainer";

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-400">加载中...</div>}>
      <ChatContainer />
    </Suspense>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add AI interview chat interface"
```

---

### Task 10: Results Page + ScoreCard

**Files:**
- Create: `src/components/interview/ScoreCard.tsx`, `src/app/results/[id]/page.tsx`

- [ ] **Step 1: Write ScoreCard component — src/components/interview/ScoreCard.tsx**

```tsx
interface ScoreCardProps {
  position: string;
  date: string;
  overallScore: number;
  categories: { tech: number; project: number; softSkills: number };
  strengths: string;
  weaknesses: string;
  resumeSuggestions: string;
}

export default function ScoreCard({
  position,
  date,
  overallScore,
  categories,
  strengths,
  weaknesses,
  resumeSuggestions,
}: ScoreCardProps) {
  const getBarColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const dimensions: Array<{ key: keyof typeof categories; label: string }> = [
    { key: "tech", label: "技术基础" },
    { key: "project", label: "项目经验" },
    { key: "softSkills", label: "软技能" },
  ];

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-bold">{position} 面试评分</h1>
        <p className="text-sm text-gray-400 mt-1">{date}</p>
      </div>

      <div className="flex justify-center">
        <div
          className="w-28 h-28 rounded-full border-4 flex items-center justify-center"
          style={{ borderColor: overallScore >= 80 ? "#10b981" : overallScore >= 60 ? "#f59e0b" : "#ef4444" }}
        >
          <span className="text-3xl font-bold">{overallScore}</span>
        </div>
      </div>

      <div className="space-y-3 bg-white rounded-xl p-5 border border-gray-100">
        {dimensions.map(({ key, label }) => (
          <div key={key}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">{label}</span>
              <span className="font-medium">{categories[key]}</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full">
              <div
                className={`h-2 rounded-full ${getBarColor(categories[key])}`}
                style={{ width: `${categories[key]}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-5 border border-gray-100 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-green-600 mb-1">优势</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{strengths}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-orange-600 mb-1">待改进</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{weaknesses}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-indigo-600 mb-1">简历优化建议</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{resumeSuggestions}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <a
          href="/interview/setup"
          className="flex-1 text-center py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
        >
          再来一次
        </a>
        <a
          href="/dashboard"
          className="flex-1 text-center py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
        >
          返回列表
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write results page — src/app/results/[id]/page.tsx**

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ScoreCard from "@/components/interview/ScoreCard";

async function getInterviewData(id: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/interviews/${id}`, {
    headers: token ? { Cookie: `token=${token}` } : {},
  });

  if (!res.ok) return null;
  return res.json();
}

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getInterviewData(id);

  if (!data || !data.evaluation) {
    redirect("/dashboard");
  }

  const { interview, evaluation } = data;

  return (
    <div className="min-h-screen py-12 px-4">
      <ScoreCard
        position={interview.position}
        date={new Date(interview.createdAt).toLocaleDateString("zh-CN")}
        overallScore={evaluation.overallScore}
        categories={evaluation.categories}
        strengths={evaluation.strengths}
        weaknesses={evaluation.weaknesses}
        resumeSuggestions={evaluation.resumeSuggestions}
      />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add evaluation results page with score card"
```

---

### Task 11: Dashboard Page

**Files:**
- Create: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Write dashboard page — src/app/dashboard/page.tsx**

```tsx
import Link from "next/link";
import { cookies } from "next/headers";

interface InterviewSummary {
  id: number;
  position: string;
  status: string;
  overallScore: number | null;
  createdAt: string;
}

async function getInterviews(): Promise<InterviewSummary[]> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/interviews`, {
    headers: token ? { Cookie: `token=${token}` } : {},
  });

  if (!res.ok) return [];
  return res.json();
}

export default async function DashboardPage() {
  const interviews = await getInterviews();

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">面试记录</h1>
        <Link
          href="/interview/setup"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          开始新面试
        </Link>
      </div>

      {interviews.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg mb-4">还没有面试记录</p>
          <Link
            href="/interview/setup"
            className="text-indigo-600 hover:underline text-sm"
          >
            开始第一次AI模拟面试
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {interviews.map((iv) => (
            <Link
              key={iv.id}
              href={iv.status === "done" ? `/results/${iv.id}` : `/interview/chat?id=${iv.id}`}
              className="flex items-center justify-between bg-white rounded-xl p-4 border border-gray-100 hover:border-indigo-200 transition-colors"
            >
              <div>
                <h3 className="font-medium text-sm">{iv.position}</h3>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(iv.createdAt).toLocaleDateString("zh-CN")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {iv.overallScore !== null ? (
                  <span className={`text-lg font-bold ${iv.overallScore >= 80 ? "text-green-500" : iv.overallScore >= 60 ? "text-yellow-500" : "text-red-500"}`}>
                    {iv.overallScore}
                  </span>
                ) : (
                  <span className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-full">进行中</span>
                )}
                <span className="text-gray-300">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add dashboard with interview history"
```

---

### Task 12: Final Verification

- [ ] **Step 1: Verify build compiles**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

Manual test checklist:
1. Visit http://localhost:3000 → redirects to /login
2. Register → redirects to /dashboard
3. Click "开始新面试" → setup page loads
4. Select position, upload PDF → parsed successfully
5. Click "开始面试" → chat page loads
6. AI interviewer asks first question
7. Type answer → next question appears
8. Click "结束面试" → evaluation generated
9. Results page shows scores, strengths, weaknesses, resume suggestions
10. Dashboard shows interview history with scores

- [ ] **Step 3: Commit any fixes**

```bash
git add -A && git commit -m "fix: integration fixes and polish"
```

---

## Self-Review

**Spec Coverage:**
- [x] 注册/登录 → Task 3 (API) + Task 4 (Pages)
- [x] 面试设置（岗位+PDF）→ Task 5 (PDF API) + Task 7 (Setup page)
- [x] AI 对话面试 → Task 6 (DeepSeek client) + Task 8 (Chat API) + Task 9 (Chat UI)
- [x] 评分报告 → Task 10 (Results page + ScoreCard)
- [x] 历史记录 → Task 11 (Dashboard)
- [x] 简历建议 → Task 6 (evaluation prompt) + Task 10 (ScoreCard displays resumeSuggestions)
- [x] 数据模型 → Task 2 (Entities)
- [x] JWT 认证 → Task 3 (auth lib + middleware)
- [x] PDF 5MB 限制 → Task 5 (MAX_SIZE constant)

**Placeholders:** None — every task has complete code, exact commands, and expected outcomes.

**Type Consistency:**
- `Interview.resumeText` used consistently across entities, API routes, and components
- `Evaluation.categories` is `{ tech, project, softSkills }` — consistent between entity, API response, and ScoreCard props
- JWT cookie named `token` — consistent in middleware, API routes, and client code
- `questionNumber` nullable — correct for user messages (null) vs interviewer messages (numbered)
