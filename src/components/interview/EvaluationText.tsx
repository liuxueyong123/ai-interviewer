export function EvaluationText({ strengths, weaknesses, resumeSuggestions, roundSummary }: { strengths: string; weaknesses: string; resumeSuggestions: string; roundSummary?: string | null }) {
  return (
    <div className="bg-surface-1 border border-border rounded-2xl p-6 space-y-5 shadow-sm">
      {roundSummary && (
        <div className="bg-purple-500/10 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-purple-400 mb-2 font-display inline-flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            本轮总结
          </h3>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{roundSummary}</p>
        </div>
      )}
      <div className="bg-accent-muted rounded-xl p-4">
        <h3 className="text-sm font-semibold text-accent mb-2 font-display inline-flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          优势
        </h3>
        <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{strengths}</p>
      </div>
      <div className="bg-amber-500/5 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-amber-400 mb-2 font-display inline-flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          待改进
        </h3>
        <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{weaknesses}</p>
      </div>
      <div className="bg-blue-500/10 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-blue-400 mb-2 font-display inline-flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          简历优化建议
        </h3>
        <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{resumeSuggestions}</p>
      </div>
    </div>
  );
}
