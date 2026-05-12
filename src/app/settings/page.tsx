"use client";

import { useState, useEffect, useRef } from "react";

export default function SettingsPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileDone, setProfileDone] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordDone, setPasswordDone] = useState(false);

  const profileTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const passwordTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.username) setUsername(data.username);
        if (data.email) setEmail(data.email);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(profileTimer.current);
      clearTimeout(passwordTimer.current);
    };
  }, []);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileError("");
    setProfileDone(false);
    setProfileLoading(true);
    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email }),
    });
    const data = await res.json();
    setProfileLoading(false);
    if (!res.ok) {
      setProfileError(data.error);
      return;
    }
    setProfileDone(true);
    profileTimer.current = setTimeout(() => setProfileDone(false), 3000);
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setPasswordDone(false);
    setPasswordLoading(true);
    const res = await fetch("/api/auth/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setPasswordLoading(false);
    if (!res.ok) {
      setPasswordError(data.error);
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setPasswordDone(true);
    passwordTimer.current = setTimeout(() => setPasswordDone(false), 3000);
  }

  const initials = username ? username.slice(0, 2).toUpperCase() : "?";

  return (
    <div className="max-w-2xl mx-auto pt-12 pb-20 px-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-10">
        <span className="w-14 h-14 rounded-2xl bg-accent-muted text-accent flex items-center justify-center text-xl font-display font-bold shadow-sm">
          {initials}
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">个人设置</h1>
          <p className="text-text-muted text-sm mt-0.5">管理账户信息与安全选项</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile card */}
        <div className="bg-surface-1 border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 pt-6 pb-4 flex items-center gap-2.5">
            <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <h2 className="font-display font-semibold text-text-primary">个人信息</h2>
          </div>

          <form onSubmit={handleProfileSubmit} className="px-6 pb-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">用户名</label>
              <input
                type="text" value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                className="w-full px-4 py-2.5 bg-surface-0 border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all duration-200"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">邮箱</label>
              <input
                type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入邮箱"
                className="w-full px-4 py-2.5 bg-surface-0 border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all duration-200"
                required
              />
            </div>

            {profileError && (
              <div className="flex items-center gap-2 text-danger text-xs bg-red-50 rounded-lg px-3 py-2.5 font-medium">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                {profileError}
              </div>
            )}

            <button
              type="submit"
              disabled={profileLoading || profileDone}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer font-display ${
                profileDone
                  ? "bg-green-50 text-green-600 pointer-events-none"
                  : "bg-accent text-white hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50"
              }`}
            >
              {profileLoading ? (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  保存中...
                </span>
              ) : profileDone ? (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  已保存
                </span>
              ) : (
                "保存修改"
              )}
            </button>
          </form>
        </div>

        {/* Password card */}
        <div className="bg-surface-1 border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 pt-6 pb-4 flex items-center gap-2.5">
            <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <h2 className="font-display font-semibold text-text-primary">修改密码</h2>
          </div>

          <form onSubmit={handlePasswordSubmit} className="px-6 pb-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">当前密码</label>
              <input
                type="password" value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="输入当前密码"
                className="w-full px-4 py-2.5 bg-surface-0 border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all duration-200"
                required autoComplete="current-password"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">新密码</label>
              <input
                type="password" value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="输入至少6位的新密码"
                className="w-full px-4 py-2.5 bg-surface-0 border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all duration-200"
                required autoComplete="new-password" minLength={6}
              />
            </div>

            {passwordError && (
              <div className="flex items-center gap-2 text-danger text-xs bg-red-50 rounded-lg px-3 py-2.5 font-medium">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                {passwordError}
              </div>
            )}

            <button
              type="submit"
              disabled={passwordLoading || passwordDone}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer font-display ${
                passwordDone
                  ? "bg-green-50 text-green-600 pointer-events-none"
                  : "bg-accent text-white hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50"
              }`}
            >
              {passwordLoading ? (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  修改中...
                </span>
              ) : passwordDone ? (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  已修改
                </span>
              ) : (
                "修改密码"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
