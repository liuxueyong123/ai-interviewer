import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "InterviewAI — AI 模拟面试",
  description: "专业AI模拟面试练习平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-surface-0 text-text-primary font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
