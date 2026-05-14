import Link from "next/link";
import { cookies } from "next/headers";
import ProgressPanel from "@/components/interview/ProgressPanel";

export const dynamic = "force-dynamic";

interface Categories {
  tech: number;
  project: number;
  softSkills: number;
}

interface InterviewSummary {
  id: number;
  title: string;
  position: string;
  status: string;
  overallScore: number | null;
  categories: Categories | null;
  currentRound: number;
  maxRounds: number;
  mode: string;
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

function StatCard({ label, value, color = "text-text-primary" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-surface-1 backdrop-blur-xl border border-white/6 rounded-2xl p-4 text-center shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_40px_rgba(139,92,246,0.08)] hover:-translate-y-0.5 transition-all duration-200">
      <p className={`font-display text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-text-muted text-xs mt-1">{label}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const interviews = await getInterviews();
  const completed = interviews.filter((i) => i.overallScore !== null);
  const avgScore = completed.length > 0 ? Math.round(completed.reduce((s, i) => s + i.overallScore!, 0) / completed.length) : null;
  const bestScore = completed.length > 0 ? Math.max(...completed.map((i) => i.overallScore!)) : null;

  const chartData = completed
    .reverse()
    .map((i, idx) => ({
      label: `#${idx + 1}`,
      title: i.title,
      date: i.createdAt,
      score: i.overallScore!,
    }));

  return (
    <div className="max-w-2xl mx-auto pt-8 pb-12 px-4">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
            Interview<span className="text-accent">AI</span>
          </h1>
          <p className="text-text-muted text-sm mt-1">面试记录</p>
        </div>
        <Link
          href="/interview/setup"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover hover:shadow-md hover:shadow-accent/20 active:scale-[0.98] transition-all duration-200 font-display text-sm shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          开始新面试
        </Link>
      </div>

      {interviews.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 animate-fade-in-up">
          <StatCard label="面试总次数" value={interviews.length} />
          <StatCard label="已完成" value={completed.length} />
          <StatCard
            label="平均分"
            value={avgScore !== null ? avgScore : "--"}
            color={avgScore !== null ? (avgScore >= 80 ? "text-accent" : avgScore >= 60 ? "text-amber-400" : "text-danger") : "text-text-muted"}
          />
          <StatCard
            label="最高分"
            value={bestScore !== null ? bestScore : "--"}
            color={bestScore !== null ? (bestScore >= 80 ? "text-accent" : bestScore >= 60 ? "text-amber-400" : "text-danger") : "text-text-muted"}
          />
        </div>
      )}

      {chartData.length >= 2 && (
        <div className="mb-8">
          <ProgressPanel data={chartData} />
        </div>
      )}

      {interviews.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-accent-muted to-transparent border border-white/6 flex items-center justify-center">
            <svg className="w-10 h-10 text-accent/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
              />
            </svg>
          </div>
          <h2 className="text-text-secondary text-lg font-semibold mb-2 font-display">准备好了吗？</h2>
          <p className="text-text-muted text-sm mb-8">开始你的第一次 AI 模拟面试，获得专业评估反馈</p>
          <Link
            href="/interview/setup"
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/20 active:scale-[0.98] transition-all duration-200 font-display text-sm shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            开始第一次面试
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {interviews.map((iv, i) => (
            <Link
              key={iv.id}
              href={iv.status === "ongoing" ? (iv.mode === "voice" ? `/interview/voice?id=${iv.id}` : `/interview/chat?id=${iv.id}`) : `/results/${iv.id}`}
              className="flex items-center justify-between bg-surface-1 backdrop-blur-xl border border-white/6 rounded-2xl p-5 hover:border-accent/30 hover:shadow-[0_8px_30px_rgba(139,92,246,0.08)] hover:-translate-y-0.5 transition-all duration-200 group animate-fade-in-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div>
                <h3 className="font-display font-semibold text-sm text-text-primary group-hover:text-accent transition-all duration-200">{iv.title}</h3>
                <p className="text-text-muted text-xs mt-1">
                  {new Date(iv.createdAt).toLocaleString("zh-CN", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {iv.status === "passed" ? (
                  <span className="inline-flex items-center gap-2 text-xs px-3 py-1.5 bg-green-500/10 text-green-400 rounded-full font-medium">
                    <span className="font-display text-base font-bold">{iv.overallScore}</span>
                    第{iv.currentRound}/{iv.maxRounds}轮通过
                  </span>
                ) : iv.status === "done" ? (
                  <span className={`font-display text-xl font-bold ${iv.overallScore != null && iv.overallScore >= 80 ? "text-accent" : iv.overallScore != null && iv.overallScore >= 60 ? "text-amber-400" : "text-danger"}`}>{iv.overallScore ?? "--"}</span>
                ) : iv.status === "evaluating" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse-dot" />
                    评估中
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse-dot" />
                    {iv.maxRounds > 1 ? `第${iv.currentRound}/${iv.maxRounds}轮进行中` : "进行中"}
                  </span>
                )}
                <svg className="w-5 h-5 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
