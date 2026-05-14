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
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5"
          />
        </svg>
        针对性练习建议
      </h3>
      <div className="space-y-3">
        {suggestions.map((item, idx) => (
          <div key={idx} className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20">
            <h4 className="text-sm font-semibold text-purple-300 mb-1">{item.area}</h4>
            <p className="text-xs text-text-muted mb-2">{item.description}</p>
            <div className="flex gap-2">
              <svg className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                />
              </svg>
              <p className="text-sm text-text-secondary leading-relaxed">{item.suggestion}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
