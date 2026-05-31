"use client";

interface SubtitleBarProps {
  text: string;
  visible: boolean;
  loading?: boolean;
}

export default function SubtitleBar({ text, visible, loading }: SubtitleBarProps) {
  if (!visible || (!text && !loading)) {
    return <div className="min-h-[44px]" />;
  }

  return (
    <div className="px-4 py-2.5 mx-2 rounded-lg bg-indigo-500/8 border border-indigo-400/15 text-center min-h-[44px] flex items-center justify-center">
      {loading ? (
        <span className="inline-flex items-center gap-1">
          <span className="text-sm text-slate-400">{text || "正在组织问题"}</span>
          <span className="inline-flex gap-0.5 ml-1">
            <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce-dot [animation-delay:0ms]" />
            <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce-dot [animation-delay:150ms]" />
            <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce-dot [animation-delay:300ms]" />
          </span>
        </span>
      ) : (
        <p key={text} className="text-sm text-slate-200 leading-relaxed animate-fadeIn">
          &ldquo;{text}&rdquo;
        </p>
      )}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce-dot {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
        .animate-fadeIn { animation: fadeIn 0.35s ease-out; }
        .animate-bounce-dot { animation: bounce-dot 1.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
