interface ScoreCardProps {
  heading: string;
  date: string;
  overallScore: number;
  categories: { tech: number; project: number; softSkills: number };
  strengths: string;
  weaknesses: string;
  resumeSuggestions: string;
}

export function scoreColor(s: number) {
  return s >= 80 ? "text-accent" : s >= 60 ? "text-amber-500" : "text-danger";
}
export function barColor(s: number) {
  return s >= 80 ? "bg-accent" : s >= 60 ? "bg-amber-400" : "bg-danger";
}
export function reviewBg(s: number) {
  return s >= 80
    ? "bg-accent-muted border-accent/20"
    : s >= 60
    ? "bg-amber-50 border-amber-200"
    : "bg-danger-muted border-danger/20";
}
export function reviewText(s: number) {
  return s >= 80 ? "text-accent" : s >= 60 ? "text-amber-600" : "text-danger";
}

export function ScoreRing({ score }: { score: number }) {
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

const dims = [
  { key: "tech" as const, label: "技术基础", icon: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" },
  { key: "project" as const, label: "项目经验", icon: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" },
  { key: "softSkills" as const, label: "软技能", icon: "M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" },
];

export function CategoryBars({ categories }: { categories: { tech: number; project: number; softSkills: number } }) {
  return (
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
  );
}

export function EvaluationText({ strengths, weaknesses, resumeSuggestions }: { strengths: string; weaknesses: string; resumeSuggestions: string }) {
  return (
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
  );
}

interface QuestionReview {
  questionNumber: number;
  question: string;
  score: number;
  comment: string;
}

interface MessageItem {
  id: number;
  role: string;
  content: string;
  questionNumber: number | null;
}

export function InterviewReview({ messages, reviews }: { messages: MessageItem[]; reviews?: QuestionReview[] | null }) {
  if (!messages?.length) return null;

  const pairs: Array<{
    questionNumber: number;
    question: string;
    answer: string;
    review?: QuestionReview;
  }> = [];

  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === "interviewer" && messages[i].questionNumber != null) {
      const qNum = messages[i].questionNumber as number;
      const answer = messages[i + 1]?.role === "user" ? messages[i + 1].content : "";
      const review = reviews?.find((r) => r.questionNumber === qNum);
      pairs.push({ questionNumber: qNum, question: messages[i].content, answer, review });
    }
  }

  return (
    <div className="bg-surface-1 border border-border rounded-2xl shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-accent via-accent to-emerald-400 shrink-0" />
      <div className="p-6">
        <h3 className="font-display text-sm font-semibold text-text-primary mb-4 inline-flex items-center gap-2">
          <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
          </svg>
          面试回顾
        </h3>
        <div className="space-y-3">
          {pairs.map((p) => (
            <details key={p.questionNumber} className="group bg-surface-2 rounded-xl transition-all duration-200">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none">
                <span className="text-sm font-medium text-text-secondary">
                  Q{p.questionNumber} {p.question.length > 40 ? p.question.slice(0, 40) + "..." : p.question}
                </span>
                {p.review && (
                  <span className={`font-display text-sm font-bold ml-3 shrink-0 ${scoreColor(p.review.score)}`}>{p.review.score}</span>
                )}
              </summary>
              <div className="px-4 pb-3 space-y-3">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <span className="text-xs font-semibold text-accent bg-accent-muted rounded-md px-2 py-0.5 shrink-0 self-start mt-0.5">Q</span>
                    <p className="text-sm text-text-primary leading-relaxed">{p.question}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-xs font-semibold text-text-muted bg-surface-3 rounded-md px-2 py-0.5 shrink-0 self-start mt-0.5">A</span>
                    <p className="text-sm text-text-secondary leading-relaxed">{p.answer || "（未回答）"}</p>
                  </div>
                </div>
                {p.review && (
                  <div className={`rounded-lg p-3 border ${reviewBg(p.review.score)}`}>
                    <p className={`text-sm leading-relaxed font-medium ${reviewText(p.review.score)}`}>{p.review.comment}</p>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}

interface PracticeSuggestion {
  area: string;
  description: string;
  suggestion: string;
}

export function PracticePanel({ suggestions }: { suggestions: PracticeSuggestion[] | null }) {
  if (!suggestions?.length) return null;

  return (
    <div className="bg-surface-1 border border-border rounded-2xl p-6 space-y-4 shadow-sm">
      <h3 className="font-display text-sm font-semibold text-text-primary inline-flex items-center gap-2">
        <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
        </svg>
        针对性练习建议
      </h3>
      <div className="space-y-3">
        {suggestions.map((item, idx) => (
          <div key={idx} className="bg-purple-50 rounded-xl p-4 border border-purple-200/60">
            <h4 className="text-sm font-semibold text-purple-700 mb-1">{item.area}</h4>
            <p className="text-xs text-text-muted mb-2">{item.description}</p>
            <div className="flex gap-2">
              <svg className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
              <p className="text-sm text-text-secondary leading-relaxed">{item.suggestion}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ScoreCard({ heading, date, overallScore, categories, strengths, weaknesses, resumeSuggestions }: ScoreCardProps) {
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="text-center">
        <p className="text-text-muted text-xs mb-2">{date}</p>
        <h1 className="font-display text-xl font-bold text-text-primary">{heading} 面试评分</h1>
      </div>

      <div className="flex justify-center">
        <ScoreRing score={overallScore} />
      </div>

      <CategoryBars categories={categories} />
      <EvaluationText strengths={strengths} weaknesses={weaknesses} resumeSuggestions={resumeSuggestions} />
    </div>
  );
}
