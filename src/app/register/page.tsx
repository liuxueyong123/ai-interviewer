"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerSchema } from "@/lib/validations";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const parsed = registerSchema.safeParse({ username, email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl font-bold tracking-tight text-text-primary">
            Interview<span className="text-accent">AI</span>
          </h1>
          <p className="text-text-muted text-sm mt-2">专业 AI 模拟面试练习平台</p>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-accent via-accent to-emerald-400" />
          <div className="p-8">
          <h2 className="font-display text-lg font-semibold text-text-primary mb-6">注册</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">用户名</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                className="w-full px-4 py-3 bg-surface-0 border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all duration-200"
                required autoComplete="username" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">邮箱</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入邮箱地址"
                className="w-full px-4 py-3 bg-surface-0 border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all duration-200"
                required autoComplete="email" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">密码</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full px-4 py-3 bg-surface-0 border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all duration-200"
                required autoComplete="new-password" />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 font-medium">{error}</div>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50 transition-all duration-200 font-display cursor-pointer">
              {loading ? "注册中..." : "注册"}
            </button>
          </form>
          </div>
        </div>

        <p className="text-center text-text-muted text-sm mt-6">
          已有账号？<Link href="/login" className="text-accent hover:text-accent-hover font-medium transition-all duration-200">登录</Link>
        </p>
      </div>
    </div>
  );
}
