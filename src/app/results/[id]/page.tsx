"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { CategoryBars, EvaluationText, InterviewReview, PracticePanel, ScoreRing } from "@/components/interview/ScoreCard";
import Steps from "@/components/interview/Steps";
import RetryButton from "@/components/interview/RetryButton";
import { toast } from "@/components/ui/Toast";
import EvaluatingSpinner from "@/components/results/EvaluatingSpinner";
import { useResultsPolling } from "@/hooks/useResultsPolling";
import { deriveSteps, deriveStatusMessage } from "@/lib/resultsHelpers";

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error, timedOut, fetchData, handleRetry } = useResultsPolling(id);
  const [selectedRound, setSelectedRound] = useState(1);
  const initialRoundSet = useRef(false);

  // Auto-select the latest evaluation round on first data load
  useEffect(() => {
    if (!data || initialRoundSet.current) return;
    if (data.evaluations.length > 0) {
      setSelectedRound(data.evaluations[data.evaluations.length - 1].round);
      initialRoundSet.current = true;
    }
  }, [data]);

  const wrappedHandleRetry = useCallback(async () => {
    try {
      await handleRetry();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "重试失败");
    }
  }, [handleRetry]);

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
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
              <p className="text-amber-400 text-sm mb-3">评估时间超过预期，可能是网络波动导致</p>
              <button
                onClick={wrappedHandleRetry}
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

  const partialEval = selectedRound === interview.currentRound ? null : evaluations.find((e) => e.round === selectedRound) || evaluations[evaluations.length - 1];
  const partialMessages = messages.filter((m) => m.round === selectedRound);

  // Evaluating state — previous rounds done, current round being evaluated
  if (!currentRoundHasEval && evaluations.length > 0 && interview.status === "evaluating") {
    const steps = deriveSteps(interview.maxRounds, interview.currentRound, interview.status, evaluations);
    const statusMsg = deriveStatusMessage(interview.status, interview.currentRound, interview.maxRounds, evaluations.length);

    return (
      <div className="min-h-screen pt-8 pb-16 px-4">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="text-center">
            <h1 className="font-display text-xl font-bold text-text-primary mb-4">{interview.title}</h1>
            <Steps steps={steps} selectedRound={selectedRound} onSelectRound={setSelectedRound} statusMessage={statusMsg} />

            {timedOut && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 max-w-md mx-auto mt-6">
                <p className="text-amber-400 text-sm mb-3">评估时间超过预期，可能是网络波动导致</p>
                <button
                  onClick={wrappedHandleRetry}
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
                <EvaluationText strengths={partialEval.strengths} weaknesses={partialEval.weaknesses} resumeSuggestions={partialEval.resumeSuggestions} roundSummary={partialEval.roundSummary} />
                <PracticePanel suggestions={partialEval.practiceSuggestions} />
              </div>
              <div className="min-w-0 mt-8 lg:mt-0">
                <div className="lg:top-20 space-y-6">
                  <CategoryBars categories={partialEval.categories} />
                  <InterviewReview messages={partialMessages} reviews={partialEval.questionReviews} round={selectedRound} />
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

  const steps = deriveSteps(interview.maxRounds, interview.currentRound, interview.status, evaluations);
  const isFailed = isDone && evaluations.length < interview.maxRounds;

  return (
    <div className="min-h-screen pt-8 pb-16 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center">
          <p className="text-text-muted text-xs mb-2">{dateStr}</p>
          <h1 className="font-display text-xl font-bold text-text-primary mb-4">{interview.title}</h1>

          {isFailed && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 max-w-md mx-auto mb-4">
              <p className="text-amber-300 text-sm font-semibold mb-1">😔&nbsp;很遗憾，面试已结束</p>
              <p className="text-amber-400 text-sm">您在第{interview.currentRound}轮面试中未达到通过分数，感谢您的参与～</p>
              <div className="mt-2 flex justify-center">
                <RetryButton interviewId={interview.id} />
              </div>
            </div>
          )}

          {isDone && !isFailed && interview.maxRounds > 1 && (
            <div className="bg-accent-muted border border-accent/20 rounded-xl p-4 max-w-md mx-auto mb-4">
              <p className="text-accent text-sm font-semibold mb-2">🎉&nbsp;恭喜您完成了全部 {interview.maxRounds} 轮面试！</p>
              <p className="text-text-secondary text-sm leading-relaxed">每次练习都是成长，已生成评估报告和改进建议，继续加油吧！</p>
              <div className="mt-2 flex justify-center">
                <RetryButton interviewId={interview.id} />
              </div>
            </div>
          )}

          {interview.maxRounds > 1 ? (
            <Steps
              steps={steps}
              selectedRound={selectedRound}
              onSelectRound={setSelectedRound}
              onNextRound={isPassed ? handleNextRound : undefined}
              statusMessage={isDone ? undefined : deriveStatusMessage(interview.status, interview.currentRound, interview.maxRounds, evaluations.length)}
            />
          ) : (
            <div className="flex justify-center mt-4">
              <ScoreRing score={selectedEval.overallScore} />
            </div>
          )}
        </div>

        <div className="lg:grid lg:grid-cols-2 lg:gap-8">
          <div className="space-y-6 min-w-0">
            <EvaluationText strengths={selectedEval.strengths} weaknesses={selectedEval.weaknesses} resumeSuggestions={selectedEval.resumeSuggestions} roundSummary={selectedEval.roundSummary} />
            <PracticePanel suggestions={selectedEval.practiceSuggestions} />
          </div>

          <div className="min-w-0 mt-8 lg:mt-0">
            <div className="lg:top-20 space-y-6">
              <CategoryBars categories={selectedEval.categories} />
              <InterviewReview messages={selectedMessages} reviews={selectedEval.questionReviews} round={selectedRound} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
