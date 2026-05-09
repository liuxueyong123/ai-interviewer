import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ScoreCard from "@/components/interview/ScoreCard";
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
  return (
    <div className="min-h-screen pt-12 pb-16 px-4">
      <div className="max-w-lg mx-auto">
        <ScoreCard
          heading={interview.title}
          date={new Date(interview.createdAt).toLocaleString("zh-CN", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          overallScore={evaluation.overallScore}
          categories={evaluation.categories}
          strengths={evaluation.strengths}
          weaknesses={evaluation.weaknesses}
          resumeSuggestions={evaluation.resumeSuggestions}
        />

        {messages?.length > 0 && (
          <>
            <div className="flex items-center gap-4 mt-10 mb-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-text-muted font-medium shrink-0">面试对话记录</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <ChatHistory messages={messages} />
          </>
        )}
      </div>
    </div>
  );
}
