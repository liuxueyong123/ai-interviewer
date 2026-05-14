"use client";

interface SubtitleBarProps {
  text: string;
  visible: boolean;
}

export default function SubtitleBar({ text, visible }: SubtitleBarProps) {
  if (!visible || !text) {
    return <div className="min-h-[44px]" />;
  }

  return (
    <div className="px-4 py-2.5 mx-2 rounded-lg bg-indigo-500/8 border border-indigo-400/15 text-center min-h-[44px] flex items-center justify-center">
      <p key={text} className="text-sm text-slate-200 leading-relaxed animate-fadeIn">
        &ldquo;{text}&rdquo;
      </p>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.35s ease-out; }
      `}</style>
    </div>
  );
}
