import { scoreColor, reviewBg, reviewText } from "./scoreUtils";

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

export function InterviewReview({ messages, reviews, round }: { messages: MessageItem[]; reviews?: QuestionReview[] | null; round?: number }) {
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
      const review = reviews?.find((r) => r.questionNumber == qNum);
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
          {round != null ? `第${round}轮面试回顾` : "面试回顾"}
        </h3>
        <div className="space-y-3">
          {pairs.map((p) => (
            <details key={p.questionNumber} className="group bg-surface-2 rounded-xl transition-all duration-200">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none">
                <span className="text-sm font-medium text-text-secondary">
                  Q{p.questionNumber} {p.question.length > 40 ? p.question.slice(0, 40) + "..." : p.question}
                </span>
                {p.review && <span className={`font-display text-sm font-bold ml-3 shrink-0 ${scoreColor(p.review.score)}`}>{p.review.score}</span>}
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
