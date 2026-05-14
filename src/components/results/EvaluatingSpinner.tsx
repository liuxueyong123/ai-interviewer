export default function EvaluatingSpinner({ small }: { small?: boolean }) {
  const size = small ? "w-5 h-5" : "w-20 h-20";
  const innerSize = small ? "w-3 h-3" : "w-7 h-7";
  const border = small ? "border-2" : "border-4";
  return (
    <div className={`relative ${size} mx-auto`}>
      <div className={`absolute inset-0 rounded-full ${border} border-surface-2`} />
      <div className={`absolute inset-0 rounded-full ${border} border-transparent border-t-accent animate-spin`} />
      {!small && (
        <div className="absolute inset-2 rounded-full bg-accent-muted flex items-center justify-center">
          <svg className={`${innerSize} text-accent animate-pulse`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
