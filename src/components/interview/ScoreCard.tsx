interface ScoreCardProps {
  position: string;
  date: string;
  overallScore: number;
  categories: { tech: number; project: number; softSkills: number };
  strengths: string;
  weaknesses: string;
  resumeSuggestions: string;
}

export default function ScoreCard({
  position,
  date,
  overallScore,
  categories,
  strengths,
  weaknesses,
  resumeSuggestions,
}: ScoreCardProps) {
  const getBarColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const dimensions: Array<{ key: keyof typeof categories; label: string }> = [
    { key: "tech", label: "技术基础" },
    { key: "project", label: "项目经验" },
    { key: "softSkills", label: "软技能" },
  ];

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-bold">{position} 面试评分</h1>
        <p className="text-sm text-gray-400 mt-1">{date}</p>
      </div>

      <div className="flex justify-center">
        <div
          className="w-28 h-28 rounded-full border-4 flex items-center justify-center"
          style={{ borderColor: overallScore >= 80 ? "#10b981" : overallScore >= 60 ? "#f59e0b" : "#ef4444" }}
        >
          <span className="text-3xl font-bold">{overallScore}</span>
        </div>
      </div>

      <div className="space-y-3 bg-white rounded-xl p-5 border border-gray-100">
        {dimensions.map(({ key, label }) => (
          <div key={key}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">{label}</span>
              <span className="font-medium">{categories[key]}</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full">
              <div
                className={`h-2 rounded-full ${getBarColor(categories[key])}`}
                style={{ width: `${categories[key]}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-5 border border-gray-100 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-green-600 mb-1">优势</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{strengths}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-orange-600 mb-1">待改进</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{weaknesses}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-indigo-600 mb-1">简历优化建议</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{resumeSuggestions}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <a
          href="/interview/setup"
          className="flex-1 text-center py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
        >
          再来一次
        </a>
        <a
          href="/dashboard"
          className="flex-1 text-center py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
        >
          返回列表
        </a>
      </div>
    </div>
  );
}
