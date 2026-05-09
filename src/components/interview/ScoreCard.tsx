interface ScoreCardProps {
  heading: string;
  date: string;
  overallScore: number;
  categories: { tech: number; project: number; softSkills: number };
  strengths: string;
  weaknesses: string;
  resumeSuggestions: string;
}

function scoreColor(s: number) {
  return s >= 80 ? "text-accent" : s >= 60 ? "text-amber-500" : "text-danger";
}
function barColor(s: number) {
  return s >= 80 ? "bg-accent" : s >= 60 ? "bg-amber-400" : "bg-danger";
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  const circumference = 2 * Math.PI * 42;
  const offset = circumference * (1 - score / 100);
  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90 w-full h-full" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="6" />
        <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-700 ease-out" />
      </svg>
      <span className={`font-display text-4xl font-bold ${scoreColor(score)}`}>{score}</span>
    </div>
  );
}

export default function ScoreCard({ heading, date, overallScore, categories, strengths, weaknesses, resumeSuggestions }: ScoreCardProps) {
  const dims = [
    { key: "tech" as const, label: "技术基础", icon: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" },
    { key: "project" as const, label: "项目经验", icon: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" },
    { key: "softSkills" as const, label: "软技能", icon: "M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" },
  ];

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="text-center">
        <p className="text-text-muted text-xs mb-2">{date}</p>
        <h1 className="font-display text-xl font-bold text-text-primary">{heading} 面试评分</h1>
      </div>

      <div className="flex justify-center">
        <ScoreRing score={overallScore} />
      </div>

      <div className="bg-surface-1 border border-border rounded-2xl p-6 space-y-5 shadow-sm">
        {dims.map(({ key, label, icon }) => (
          <div key={key}>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-text-secondary font-medium inline-flex items-center gap-1.5">
                <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                </svg>
                {label}
              </span>
              <span className={`font-display font-bold ${scoreColor(categories[key])}`}>{categories[key]}</span>
            </div>
            <div className="w-full h-2.5 bg-surface-2 rounded-full overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-700 ease-out ${barColor(categories[key])}`}
                style={{ width: `${categories[key]}%`, boxShadow: `0 0 8px rgba(${categories[key] >= 80 ? "34,197,94" : categories[key] >= 60 ? "245,158,11" : "239,68,68"}, 0.15)` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-surface-1 border border-border rounded-2xl p-6 space-y-5 shadow-sm">
        <div className="bg-accent-muted rounded-xl p-4">
          <h3 className="text-sm font-semibold text-accent mb-2 font-display inline-flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            优势
          </h3>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{strengths}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-600 mb-2 font-display inline-flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            待改进
          </h3>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{weaknesses}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-blue-600 mb-2 font-display inline-flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            简历优化建议
          </h3>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{resumeSuggestions}</p>
        </div>
      </div>
    </div>
  );
}
