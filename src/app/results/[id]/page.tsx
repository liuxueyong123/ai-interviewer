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
  }>;
}

const POLL_INTERVAL = 5000;
const TIMEOUT_MS = 300_000;

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<InterviewData | null>(null);
  const [error, setError] = useState("");
  const [timedOut, setTimedOut] = useState(false);
  const [selectedRound, setSelectedRound] = useState(1);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const initialRoundSet = useRef(false);

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

      const currentRoundHasEval = json.evaluations?.some(
        (e: { round: number }) => e.round === json.interview.currentRound
      );
      if (currentRoundHasEval || (json.evaluations?.length && json.interview.status !== "evaluating")) {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        if (!initialRoundSet.current && json.evaluations.length > 0) {
          setSelectedRound(json.evaluations[json.evaluations.length - 1].round);
          initialRoundSet.current = true;
        }
        return;
      }

      if (json.interview.status !== "evaluating" && json.interview.status !== "passed") {
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
    if (!data || pollTimerRef.current) return;
    const curRoundHasEval = data.evaluations.some((e) => e.round === data.interview.currentRound);
    if (data.interview.status === "evaluating" && !curRoundHasEval) {
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

  const handleNextRound = useCallback(async () => {
    const res = await fetch(`/api/interviews/${id}/next-round`, { method: "POST", credentials: "include" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "请求失败" }));
      toast.error(body.error || "启动下一轮失败");
      return;
    }
    router.push(`/interview/chat?id=${id}`);
  }, [id, router]);

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

  const { interview, evaluations, messages } = data;

  const currentRoundHasEval = evaluations.some((e) => e.round === interview.currentRound);

  // Evaluating state — no evaluations yet (first round)
  if (evaluations.length === 0 && interview.status === "evaluating") {
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

  const partialEval = selectedRound === interview.currentRound
    ? null
    : evaluations.find((e) => e.round === selectedRound) || evaluations[evaluations.length - 1];
  const partialMessages = messages.filter((m) => m.round === selectedRound);

  // Evaluating state — previous rounds done, current round being evaluated
  if (!currentRoundHasEval && evaluations.length > 0 && interview.status === "evaluating") {
    return (
      <div className="min-h-screen pt-8 pb-16 px-4">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="text-center">
            <h1 className="font-display text-xl font-bold text-text-primary mb-2">
              {interview.title} — 第 {interview.currentRound}/{interview.maxRounds} 轮评估中
            </h1>
            <p className="text-text-muted text-sm mb-6">AI 正在分析本轮面试表现，预计需要 3 分钟左右</p>

            <div className="flex justify-center mb-6">
              <div className="inline-flex bg-surface-2 rounded-xl p-1 gap-1">
                {evaluations.map((e) => (
                  <button
                    key={e.round}
                    onClick={() => setSelectedRound(e.round)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      e.round === selectedRound
                        ? "bg-surface-1 text-text-primary shadow-sm"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    第{e.round}轮
                    <span className="font-display font-bold">{e.overallScore}</span>
                  </button>
                ))}
                <button
                  onClick={() => setSelectedRound(interview.currentRound)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    interview.currentRound === selectedRound
                      ? "bg-surface-1 text-text-primary shadow-sm"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  <EvaluatingSpinner small />
                  第{interview.currentRound}轮评估中
                </button>
              </div>
            </div>

            {timedOut && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 max-w-md mx-auto">
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

          {partialEval ? (
            <div className="lg:grid lg:grid-cols-2 lg:gap-8">
              <div className="space-y-6 min-w-0">
                <CategoryBars categories={partialEval.categories} />
                <EvaluationText strengths={partialEval.strengths} weaknesses={partialEval.weaknesses} resumeSuggestions={partialEval.resumeSuggestions} />
                <PracticePanel suggestions={partialEval.practiceSuggestions} />
              </div>
              <div className="min-w-0 mt-8 lg:mt-0">
                <div className="lg:top-20">
                  <InterviewReview messages={partialMessages} reviews={partialEval.questionReviews} />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-12">
              <EvaluatingSpinner />
            </div>
          )}
        </div>
      </div>
    );
  }

  const isPassed = interview.status === "passed";
  const isDone = interview.status === "done";

  const selectedEval = evaluations.find((e) => e.round === selectedRound) || evaluations[evaluations.length - 1];
  const selectedMessages = messages.filter((m) => m.round === selectedRound);

  // Done / Passed state — render results
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
          <h1 className="font-display text-xl font-bold text-text-primary mb-2">
            {interview.title} {isPassed ? `— 第 ${interview.currentRound}/${interview.maxRounds} 轮通过` : "面试评分"}
          </h1>
          {interview.maxRounds > 1 && isDone && (
            <p className="text-text-muted text-xs mb-4">
              {evaluations.length === interview.maxRounds ? "全部轮次已完成" : `完成 ${evaluations.length}/${interview.maxRounds} 轮`}
            </p>
          )}
          <div className="flex justify-center gap-3 mb-8">
            {isPassed && (
              <button
                onClick={handleNextRound}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover active:scale-[0.98] transition-all duration-200 font-display text-sm shadow-sm"
              >
                进入下一轮
              </button>
            )}
            {isDone && (
              <RetryButton position={interview.position} resumeText={interview.resumeText} questionCount={interview.questionCount} difficulty={interview.difficulty} />
            )}
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-surface-1 border border-border text-text-secondary font-medium rounded-xl hover:border-text-muted active:scale-[0.98] transition-all duration-200 font-display text-sm shadow-sm"
            >
              返回列表
            </a>
          </div>
          <div className="flex justify-center">
            <ScoreRing score={selectedEval.overallScore} />
          </div>
        </div>

        {evaluations.length > 1 && (
          <div className="flex justify-center">
            <div className="inline-flex bg-surface-2 rounded-xl p-1 gap-1">
              {evaluations.map((e) => {
                const active = e.round === selectedRound;
                return (
                  <button
                    key={e.round}
                    onClick={() => setSelectedRound(e.round)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      active
                        ? "bg-surface-1 text-text-primary shadow-sm"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    {e.round < interview.currentRound || isDone ? (
                      <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    ) : null}
                    第{e.round}轮
                    <span className={`font-display font-bold ${active ? "text-text-primary" : ""}`}>{e.overallScore}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="lg:grid lg:grid-cols-2 lg:gap-8">
          <div className="space-y-6 min-w-0">
            <CategoryBars categories={selectedEval.categories} />
            <EvaluationText strengths={selectedEval.strengths} weaknesses={selectedEval.weaknesses} resumeSuggestions={selectedEval.resumeSuggestions} />
            <PracticePanel suggestions={selectedEval.practiceSuggestions} />
          </div>

          <div className="min-w-0 mt-8 lg:mt-0">
            <div className="lg:top-20">
              <InterviewReview messages={selectedMessages} reviews={selectedEval.questionReviews} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EvaluatingSpinner({ small }: { small?: boolean }) {
  const size = small ? "w-5 h-5" : "w-20 h-20";
  const innerSize = small ? "w-3 h-3" : "w-7 h-7";
  const border = small ? "border-2" : "border-4";
  return (
    <div className={`relative ${size} mx-auto`}>
      <div className={`absolute inset-0 rounded-full ${border} border-surface-2`} />
      <div className={`absolute inset-0 rounded-full ${border} border-transparent border-t-accent animate-spin`} />
      {!small && (
        <div className="absolute inset-2 rounded-full bg-accent-muted flex items-center justify-center">
          <svg className={`${innerSize} text-accent animate-pulse`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
