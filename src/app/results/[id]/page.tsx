import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ScoreRing, CategoryBars, EvaluationText, InterviewReview, PracticePanel } from "@/components/interview/ScoreCard";
import RetryButton from "@/components/interview/RetryButton";

export const dynamic = "force-dynamic";

async function getInterviewData(id: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/interviews/${id}`, {
    headers: token ? { Cookie: `token=${token}` } : {},
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getInterviewData(id);
  if (!data?.evaluation) redirect("/dashboard");

  const { interview, evaluation, messages } = data;
  const dateStr = new Date(interview.createdAt).toLocaleString("zh-CN", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen pt-8 pb-16 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Row 1: Overall score — full width */}
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
            <ScoreRing score={evaluation.overallScore} />
          </div>
        </div>

        {/* Row 2: Scores + Interview review */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-8">
          {/* Left column: category bars + evaluation text */}
          <div className="space-y-6 min-w-0">
            <CategoryBars categories={evaluation.categories} />
            <EvaluationText strengths={evaluation.strengths} weaknesses={evaluation.weaknesses} resumeSuggestions={evaluation.resumeSuggestions} />
            <PracticePanel suggestions={evaluation.practiceSuggestions} />
          </div>

          {/* Right column: merged Q&A + reviews */}
          <div className="min-w-0 mt-8 lg:mt-0">
            <div className="lg:top-20">
              <InterviewReview messages={messages} reviews={evaluation.questionReviews} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
