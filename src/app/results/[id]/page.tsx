"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ScoreRing, CategoryBars, EvaluationText, InterviewReview, PracticePanel } from "@/components/interview/ScoreCard";
import RetryButton from "@/components/interview/RetryButton";
import { toast } from "@/components/ui/Toast";

interface InterviewData {
  interview: {
    id: number;
    title: string;
    position: string;
    status: string;
    resumeText: string;
    questionCount: number;
    difficulty: string;
    createdAt: string;
  };
  messages: Array<{
    id: number;
    role: string;
    content: string;
    questionNumber: number | null;
    createdAt: string;
  }>;
  evaluation: {
    overallScore: number;
    categories: { tech: number; project: number; softSkills: number };
    strengths: string;
    weaknesses: string;
    resumeSuggestions: string;
    questionReviews: Array<{ questionNumber: number; question: string; score: number; comment: string }> | null;
    practiceSuggestions: Array<{ area: string; description: string; suggestion: string }> | null;
  } | null;
}

const POLL_INTERVAL = 5000;
const TIMEOUT_MS = 300_000;

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<InterviewData | null>(null);
  const [error, setError] = useState("");
  const [timedOut, setTimedOut] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

      if (json.evaluation) {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        return;
      }

      if (json.interview.status !== "evaluating") {
        router.push("/dashboard");
        return;
      }

      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed >= TIMEOUT_MS) {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        setTimedOut(true);
      }
    } catch {
      setError("网络错误，请检查连接后重试");
    }
  }, [id, router]);

  // Initial fetch and cleanup
  useEffect(() => {
    startTimeRef.current = Date.now();
    fetchData();
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchData]);

  // Start polling when data indicates evaluating
  useEffect(() => {
    if (!data || data.evaluation || pollTimerRef.current) return;
    if (data.interview.status === "evaluating") {
      pollTimerRef.current = setInterval(fetchData, POLL_INTERVAL);
    }
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [data, fetchData]);

  const handleRetry = useCallback(async () => {
    setTimedOut(false);
    setError("");
    const res = await fetch(`/api/interviews/${id}/finish`, { method: "POST", credentials: "include" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "请求失败" }));
      toast.error(body.error || "重试失败");
      return;
    }
    startTimeRef.current = Date.now();
    fetchData();
  }, [id, fetchData]);

  if (!data && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <EvaluatingSpinner />
          <p className="text-text-muted text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-danger text-sm">{error}</p>
          <button onClick={fetchData} className="px-4 py-2 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover active:scale-[0.98] transition-all duration-200 font-display text-sm">
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { interview, evaluation, messages } = data;

  // Evaluating state
  if (!evaluation && interview.status === "evaluating") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md space-y-6">
          <EvaluatingSpinner />
          <div>
            <h1 className="font-display text-xl font-bold text-text-primary mb-2">评估进行中</h1>
            <p className="text-text-muted text-sm">AI 正在分析你的面试表现，包括技术能力、项目经验和沟通表达...</p>
            <p className="text-text-muted text-xs mt-2">预计需要 3 分钟左右</p>
          </div>
          {timedOut && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-amber-700 text-sm mb-3">评估时间超过预期，可能是网络波动导致</p>
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover active:scale-[0.98] transition-all duration-200 font-display text-sm"
              >
                重新评估
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Done state — render full results
  const dateStr = new Date(interview.createdAt).toLocaleString("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen pt-8 pb-16 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center">
          <p className="text-text-muted text-xs mb-2">{dateStr}</p>
          <h1 className="font-display text-xl font-bold text-text-primary mb-4">{interview.title} 面试评分</h1>
          <div className="flex justify-center gap-3 mb-8">
            <RetryButton position={interview.position} resumeText={interview.resumeText} questionCount={interview.questionCount} difficulty={interview.difficulty} />
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-surface-1 border border-border text-text-secondary font-medium rounded-xl hover:border-text-muted active:scale-[0.98] transition-all duration-200 font-display text-sm shadow-sm"
            >
              返回列表
            </a>
          </div>
          <div className="flex justify-center">
            <ScoreRing score={evaluation!.overallScore} />
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-2 lg:gap-8">
          <div className="space-y-6 min-w-0">
            <CategoryBars categories={evaluation!.categories} />
            <EvaluationText strengths={evaluation!.strengths} weaknesses={evaluation!.weaknesses} resumeSuggestions={evaluation!.resumeSuggestions} />
            <PracticePanel suggestions={evaluation!.practiceSuggestions} />
          </div>

          <div className="min-w-0 mt-8 lg:mt-0">
            <div className="lg:top-20">
              <InterviewReview messages={messages} reviews={evaluation!.questionReviews} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EvaluatingSpinner() {
  return (
    <div className="relative w-20 h-20 mx-auto">
      <div className="absolute inset-0 rounded-full border-4 border-surface-2" />
      <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-accent animate-spin" />
      <div className="absolute inset-2 rounded-full bg-accent-muted flex items-center justify-center">
        <svg className="w-7 h-7 text-accent animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
          />
        </svg>
      </div>
    </div>
  );
}
