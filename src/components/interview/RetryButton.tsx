"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface RetryButtonProps {
  position: string;
  resumeText: string;
}

export default function RetryButton({ position, resumeText }: RetryButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRetry() {
    setLoading(true);
    const res = await fetch("/api/interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position, resumeText }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      router.push(`/interview/chat?id=${data.interviewId}`);
    }
  }

  return (
    <button
      onClick={handleRetry}
      disabled={loading}
      className="inline-flex items-center gap-2 px-5 py-2.5 bg-surface-1 border border-accent/30 text-accent font-semibold rounded-xl hover:bg-accent-muted hover:border-accent/50 active:scale-[0.98] transition-all duration-200 font-display text-sm shadow-sm disabled:opacity-50"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
      </svg>
      {loading ? "创建中..." : "再来一次"}
    </button>
  );
}
