"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

interface InterviewData {
  interview: {
    id: number;
    title: string;
    position: string;
    status: string;
    resumeText: string;
    questionCount: number;
    difficulty: string;
    currentRound: number;
    maxRounds: number;
    createdAt: string;
  };
  messages: Array<{
    id: number;
    role: string;
    content: string;
    round: number;
    questionNumber: number | null;
    createdAt: string;
  }>;
  evaluations: Array<{
    round: number;
    overallScore: number;
    categories: { tech: number; project: number; softSkills: number };
    strengths: string;
    weaknesses: string;
    resumeSuggestions: string;
    questionReviews: Array<{ questionNumber: number; question: string; score: number; comment: string }> | null;
    practiceSuggestions: Array<{ area: string; description: string; suggestion: string }> | null;
    roundSummary: string | null;
  }>;
}

const POLL_INTERVAL = 5000;
const TIMEOUT_MS = 300_000;

export function useResultsPolling(id: string) {
  const router = useRouter();
  const [data, setData] = useState<InterviewData | null>(null);
  const [error, setError] = useState("");
  const [timedOut, setTimedOut] = useState(false);
  const startTimeRef = useRef<number>(0);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/interviews/${id}`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 404) {
          router.push("/dashboard");
          return;
        }
        setError("加载失败，请刷新重试");
        return;
      }
      const json: InterviewData = await res.json();
      setData(json);

      const currentRoundHasEval = json.evaluations?.some((e) => e.round === json.interview.currentRound);
      if (currentRoundHasEval || (json.evaluations?.length && json.interview.status !== "evaluating")) {
        setTimedOut(false);
        return;
      }

      if (json.interview.status !== "evaluating" && json.interview.status !== "passed") {
        router.push("/dashboard");
        return;
      }

      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed >= TIMEOUT_MS) {
        setTimedOut(true);
      }
    } catch {
      setError("网络错误，请检查连接后重试");
    }
  }, [id, router]);

  const handleRetry = useCallback(async () => {
    setTimedOut(false);
    setError("");
    const res = await fetch(`/api/interviews/${id}/finish`, { method: "POST", credentials: "include" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "请求失败" }));
      throw new Error(body.error || "重试失败");
    }
    startTimeRef.current = Date.now();
    fetchData();
  }, [id, fetchData]);

  useEffect(() => {
    startTimeRef.current = Date.now();
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!data) return;
    const curRoundHasEval = data.evaluations.some((e) => e.round === data.interview.currentRound);
    if (data.interview.status !== "evaluating" || curRoundHasEval) return;

    const timer = setTimeout(fetchData, POLL_INTERVAL);
    return () => clearTimeout(timer);
  }, [data, fetchData]);

  return { data, error, timedOut, fetchData, handleRetry };
}
