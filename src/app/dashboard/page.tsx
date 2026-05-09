import Link from "next/link";
import { cookies } from "next/headers";

interface InterviewSummary {
  id: number;
  position: string;
  status: string;
  overallScore: number | null;
  createdAt: string;
}

async function getInterviews(): Promise<InterviewSummary[]> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/interviews`, {
    headers: token ? { Cookie: `token=${token}` } : {},
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function DashboardPage() {
  const interviews = await getInterviews();

  return (
    <div className="max-w-2xl mx-auto pt-12 pb-12 px-4">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
            Interview<span className="text-accent">AI</span>
          </h1>
          <p className="text-text-muted text-sm mt-1">面试记录</p>
        </div>
        <Link
          href="/interview/setup"
          className="px-5 py-2.5 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover active:scale-[0.98] transition-all duration-200 font-display text-sm shadow-sm"
        >
          开始新面试
        </Link>
      </div>

      {interviews.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-surface-2 border border-border flex items-center justify-center">
            <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <p className="text-text-secondary text-lg font-medium mb-2">还没有面试记录</p>
          <p className="text-text-muted text-sm mb-6">开始你的第一次 AI 模拟面试</p>
          <Link
            href="/interview/setup"
            className="inline-block px-6 py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover active:scale-[0.98] transition-all duration-200 font-display text-sm shadow-sm"
          >
            开始第一次面试
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {interviews.map((iv) => (
            <Link
              key={iv.id}
              href={iv.status === "done" ? `/results/${iv.id}` : `/interview/chat?id=${iv.id}`}
              className="flex items-center justify-between bg-surface-1 border border-border rounded-2xl p-5 hover:border-accent/30 hover:shadow-sm transition-all duration-200 group"
            >
              <div>
                <h3 className="font-display font-semibold text-sm text-text-primary group-hover:text-accent transition-all duration-200">{iv.position}</h3>
                <p className="text-text-muted text-xs mt-1">{new Date(iv.createdAt).toLocaleDateString("zh-CN")}</p>
              </div>
              <div className="flex items-center gap-4">
                {iv.overallScore !== null ? (
                  <span className={`font-display text-xl font-bold ${iv.overallScore >= 80 ? "text-accent" : iv.overallScore >= 60 ? "text-amber-500" : "text-danger"}`}>{iv.overallScore}</span>
                ) : (
                  <span className="text-xs px-3 py-1 bg-blue-50 text-blue-600 rounded-full font-medium">进行中</span>
                )}
                <svg className="w-5 h-5 text-text-muted group-hover:text-accent transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
