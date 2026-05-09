import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ScoreRing, CategoryBars, EvaluationText } from "@/components/interview/ScoreCard";
import ChatHistory from "@/components/chat/ChatHistory";

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
          <h1 className="font-display text-xl font-bold text-text-primary mb-8">{interview.title} 面试评分</h1>
          <div className="flex justify-center">
            <ScoreRing score={evaluation.overallScore} />
          </div>
        </div>

        {/* Row 2: Detail scores + Chat history — two columns */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-8">
          {/* Left column: category bars + evaluation text */}
          <div className="space-y-6 min-w-0">
            <CategoryBars categories={evaluation.categories} />
            <EvaluationText strengths={evaluation.strengths} weaknesses={evaluation.weaknesses} resumeSuggestions={evaluation.resumeSuggestions} />
          </div>

          {/* Right column: chat history */}
          {messages?.length > 0 ? (
            <div className="min-w-0 mt-8 lg:mt-0">
              <div className="lg:top-20">
                <div className="flex items-center gap-4 mb-6 lg:hidden">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-text-muted font-medium shrink-0">面试对话记录</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <ChatHistory messages={messages} />
              </div>
            </div>
          ) : (
            <div className="hidden lg:block" />
          )}
        </div>
      </div>
    </div>
  );
}
