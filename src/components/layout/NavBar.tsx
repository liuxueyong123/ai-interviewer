"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch {
      setLoggingOut(false);
    }
  }

  const links = [
    { href: "/dashboard", label: "面试记录" },
    { href: "/resumes", label: "简历管理" },
  ];

  return (
    <nav className="border-b border-border bg-surface-1">
      <div className="max-w-2xl mx-auto flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-display font-bold text-text-primary tracking-tight">
            Interview<span className="text-accent">AI</span>
          </Link>
          <div className="flex items-center gap-1">
            {links.map((l) => (
              <Link key={l.href} href={l.href}
                className={`px-3 py-1.5 text-sm rounded-lg transition-all duration-200 font-medium ${
                  pathname.startsWith(l.href) ? "bg-accent-muted text-accent" : "text-text-secondary hover:text-text-primary hover:bg-surface-2"
                }`}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <button onClick={handleLogout} disabled={loggingOut}
          className="text-sm text-text-muted hover:text-danger transition-all duration-200 font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          {loggingOut ? "退出中..." : "退出登录"}
        </button>
      </div>
    </nav>
  );
}
