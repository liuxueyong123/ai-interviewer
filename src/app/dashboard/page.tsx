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
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">面试记录</h1>
        <Link
          href="/interview/setup"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          开始新面试
        </Link>
      </div>

      {interviews.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg mb-4">还没有面试记录</p>
          <Link
            href="/interview/setup"
            className="text-indigo-600 hover:underline text-sm"
          >
            开始第一次AI模拟面试
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {interviews.map((iv) => (
            <Link
              key={iv.id}
              href={iv.status === "done" ? `/results/${iv.id}` : `/interview/chat?id=${iv.id}`}
              className="flex items-center justify-between bg-white rounded-xl p-4 border border-gray-100 hover:border-indigo-200 transition-colors"
            >
              <div>
                <h3 className="font-medium text-sm">{iv.position}</h3>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(iv.createdAt).toLocaleDateString("zh-CN")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {iv.overallScore !== null ? (
                  <span className={`text-lg font-bold ${iv.overallScore >= 80 ? "text-green-500" : iv.overallScore >= 60 ? "text-yellow-500" : "text-red-500"}`}>
                    {iv.overallScore}
                  </span>
                ) : (
                  <span className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-full">进行中</span>
                )}
                <span className="text-gray-300">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
