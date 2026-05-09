interface ScoreCardProps {
  position: string; date: string; overallScore: number;
  categories: { tech: number; project: number; softSkills: number };
  strengths: string; weaknesses: string; resumeSuggestions: string;
}

function scoreColor(s: number) { return s >= 80 ? "text-accent" : s >= 60 ? "text-amber-500" : "text-danger"; }
function barColor(s: number) { return s >= 80 ? "bg-accent" : s >= 60 ? "bg-amber-400" : "bg-danger"; }

export default function ScoreCard({ position, date, overallScore, categories, strengths, weaknesses, resumeSuggestions }: ScoreCardProps) {
  const dims = [
    { key: "tech" as const, label: "技术基础" },
    { key: "project" as const, label: "项目经验" },
    { key: "softSkills" as const, label: "软技能" },
  ];

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="text-center">
        <p className="text-text-muted text-xs mb-2">{date}</p>
        <h1 className="font-display text-xl font-bold text-text-primary">{position} 面试评分</h1>
      </div>

      <div className="flex justify-center">
        <div className="w-32 h-32 rounded-full border-4 flex items-center justify-center bg-surface-1 shadow-sm"
          style={{ borderColor: overallScore >= 80 ? "#22c55e" : overallScore >= 60 ? "#f59e0b" : "#ef4444" }}>
          <span className={`font-display text-4xl font-bold ${scoreColor(overallScore)}`}>{overallScore}</span>
        </div>
      </div>

      <div className="space-y-4 bg-surface-1 border border-border rounded-2xl p-6 shadow-sm">
        {dims.map(({ key, label }) => (
          <div key={key}>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-text-secondary font-medium">{label}</span>
              <span className={`font-display font-bold ${scoreColor(categories[key])}`}>{categories[key]}</span>
            </div>
            <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden">
              <div className={`h-2 rounded-full transition-all duration-200 ${barColor(categories[key])}`}
                style={{ width: `${categories[key]}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-surface-1 border border-border rounded-2xl p-6 space-y-5 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold text-accent mb-1.5 font-display">优势</h3>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{strengths}</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-amber-500 mb-1.5 font-display">待改进</h3>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{weaknesses}</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-blue-500 mb-1.5 font-display">简历优化建议</h3>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{resumeSuggestions}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <a href="/interview/setup"
          className="flex-1 text-center py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover active:scale-[0.98] transition-all duration-200 font-display text-sm shadow-sm">
          再来一次
        </a>
        <a href="/dashboard"
          className="flex-1 text-center py-3 bg-surface-1 border border-border text-text-secondary rounded-xl hover:border-text-muted transition-all duration-200 font-display text-sm">
          返回列表
        </a>
      </div>
    </div>
  );
}
