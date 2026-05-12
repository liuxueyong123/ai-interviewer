"use client";

import { useState, useEffect } from "react";
import { toast } from "@/components/ui/Toast";

export default function SettingsPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.username) setUsername(data.username);
        if (data.email) setEmail(data.email);
      })
      .catch(() => {});
  }, []);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileError("");
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
    toast.success("个人信息已更新");
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
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
    toast.success("密码已修改");
  }

  return (
    <div className="max-w-lg mx-auto py-16 px-4 space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">个人设置</h1>
        <p className="text-text-muted text-sm mt-2">管理你的账户信息和安全设置</p>
      </div>

      <div className="bg-surface-1 border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-accent via-accent to-emerald-400" />
        <div className="p-6">
          <h2 className="font-display text-base font-semibold text-text-primary mb-5">个人信息</h2>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">用户名</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-surface-0 border border-border rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all duration-200"
                required />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">邮箱</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-surface-0 border border-border rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all duration-200"
                required />
            </div>
            {profileError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 font-medium">{profileError}</div>}
            <button type="submit" disabled={profileLoading}
              className="w-full py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50 transition-all duration-200 font-display cursor-pointer">
              {profileLoading ? "保存中..." : "保存修改"}
            </button>
          </form>
        </div>
      </div>

      <div className="bg-surface-1 border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-accent via-accent to-emerald-400" />
        <div className="p-6">
          <h2 className="font-display text-base font-semibold text-text-primary mb-5">修改密码</h2>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">当前密码</label>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-3 bg-surface-0 border border-border rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all duration-200"
                required autoComplete="current-password" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">新密码</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 bg-surface-0 border border-border rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all duration-200"
                required autoComplete="new-password" />
            </div>
            {passwordError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 font-medium">{passwordError}</div>}
            <button type="submit" disabled={passwordLoading}
              className="w-full py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50 transition-all duration-200 font-display cursor-pointer">
              {passwordLoading ? "修改中..." : "修改密码"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
