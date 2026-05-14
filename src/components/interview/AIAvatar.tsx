"use client";

interface AIAvatarProps {
  state: "idle" | "speaking" | "listening" | "thinking";
}

export default function AIAvatar({ state }: AIAvatarProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="relative" style={{ width: 120, height: 120 }}>
        {/* Pulse ring */}
        <div
          className={`absolute inset-0 rounded-full border-2 transition-all duration-700 ${
            state === "speaking"
              ? "border-indigo-400/40 scale-110"
              : state === "listening"
                ? "border-amber-400/30 scale-105"
                : "border-indigo-400/15"
          }`}
        />
        <div
          className={`absolute inset-0 rounded-full border transition-all duration-1000 ${
            state === "speaking"
              ? "border-indigo-400/20 scale-125 opacity-0"
              : "border-indigo-400/10 opacity-100"
          }`}
        />

        {/* SVG Face */}
        <svg viewBox="0 0 120 120" className="w-full h-full">
          <circle cx="60" cy="50" r="28" fill="none" stroke="rgb(99,102,241)" strokeWidth="2" opacity="0.9" />
          <circle cx="49" cy="45" r="3.5" fill="rgb(129,140,248)" />
          <circle cx="71" cy="45" r="3.5" fill="rgb(129,140,248)" />
          <path d="M46 62 Q60 74 74 62" fill="none" stroke="rgb(129,140,248)" strokeWidth="2" strokeLinecap="round" />
          <rect x="38" y="80" width="44" height="10" rx="5" fill="none" stroke="rgb(99,102,241)" strokeWidth="1.5" opacity="0.4" />
        </svg>
      </div>

      {/* Sound wave bars */}
      <div className="flex gap-1 items-end" style={{ height: 28 }}>
        {[8, 16, 24, 16, 8].map((h, i) => (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-150 ${
              state === "speaking" ? "bg-indigo-400" : "bg-indigo-400/20"
            }`}
            style={{
              height: state === "speaking" ? h : 4,
              animation: state === "speaking" ? `soundbar 0.7s ease-in-out ${i * 0.1}s infinite` : "none",
            }}
          />
        ))}
      </div>

      {/* Status label */}
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            state === "speaking" ? "bg-green-500" :
            state === "listening" ? "bg-amber-400 animate-pulse" :
            state === "thinking" ? "bg-indigo-400 animate-pulse" : "bg-slate-500"
          }`}
        />
        <span className="text-xs text-slate-400">
          {state === "speaking" ? "正在说话" :
           state === "listening" ? "正在聆听" :
           state === "thinking" ? "思考中..." : "等待中"}
        </span>
      </div>

      <style>{`
        @keyframes soundbar {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1.1); }
        }
      `}</style>
    </div>
  );
}
