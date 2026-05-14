"use client";

interface AIAvatarProps {
  state: "idle" | "speaking" | "listening" | "thinking";
}

export default function AIAvatar({ state }: AIAvatarProps) {
  const isSpeaking = state === "speaking";
  const isListening = state === "listening";
  const isThinking = state === "thinking";

  const statusColor = isSpeaking ? "rgb(34,197,94)" : isListening ? "rgb(251,191,36)" : isThinking ? "rgb(99,102,241)" : "rgb(100,116,139)";
  const statusLabel = isSpeaking ? "Speaking" : isListening ? "Listening" : isThinking ? "Thinking" : "Ready";

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 w-full px-4">
      {/* Avatars container */}
      <div className="relative" style={{ width: 200, height: 200 }}>
        {/* Large hexagonal grid background */}
        <div className="absolute inset-[-20px] opacity-[0.06]" style={{
          backgroundImage: `
            linear-gradient(rgb(99,102,241) 1px, transparent 1px),
            linear-gradient(90deg, rgb(99,102,241) 1px, transparent 1px)
          `,
          backgroundSize: "30px 30px",
        }} />

        {/* Corner tech decorations */}
        <svg className="absolute inset-[-30px] w-[calc(100%+60px)] h-[calc(100%+60px)] opacity-20" viewBox="0 0 260 260">
          {/* Top-left corner */}
          <line x1="10" y1="30" x2="10" y2="10" stroke="rgb(99,102,241)" strokeWidth="1" />
          <line x1="10" y1="10" x2="30" y2="10" stroke="rgb(99,102,241)" strokeWidth="1" />
          <circle cx="10" cy="10" r="1.5" fill="rgb(129,140,248)" />
          {/* Top-right corner */}
          <line x1="250" y1="30" x2="250" y2="10" stroke="rgb(99,102,241)" strokeWidth="1" />
          <line x1="250" y1="10" x2="230" y2="10" stroke="rgb(99,102,241)" strokeWidth="1" />
          <circle cx="250" cy="10" r="1.5" fill="rgb(129,140,248)" />
          {/* Bottom-left corner */}
          <line x1="10" y1="230" x2="10" y2="250" stroke="rgb(99,102,241)" strokeWidth="1" />
          <line x1="10" y1="250" x2="30" y2="250" stroke="rgb(99,102,241)" strokeWidth="1" />
          <circle cx="10" cy="250" r="1.5" fill="rgb(129,140,248)" />
          {/* Bottom-right corner */}
          <line x1="250" y1="230" x2="250" y2="250" stroke="rgb(99,102,241)" strokeWidth="1" />
          <line x1="250" y1="250" x2="230" y2="250" stroke="rgb(99,102,241)" strokeWidth="1" />
          <circle cx="250" cy="250" r="1.5" fill="rgb(129,140,248)" />
        </svg>

        {/* Diagonal connection lines */}
        <svg className="absolute inset-[-30px] w-[calc(100%+60px)] h-[calc(100%+60px)] opacity-[0.08]" viewBox="0 0 260 260">
          <line x1="10" y1="10" x2="80" y2="80" stroke="rgb(99,102,241)" strokeWidth="0.5" />
          <line x1="250" y1="10" x2="180" y2="80" stroke="rgb(99,102,241)" strokeWidth="0.5" />
          <line x1="10" y1="250" x2="80" y2="180" stroke="rgb(99,102,241)" strokeWidth="0.5" />
          <line x1="250" y1="250" x2="180" y2="180" stroke="rgb(99,102,241)" strokeWidth="0.5" />
        </svg>

        {/* Outer rotating ring */}
        <div className="absolute inset-[-4px] rounded-full">
          <div
            className="w-full h-full rounded-full animate-spin-slow"
            style={{
              background: "conic-gradient(from 0deg, transparent, rgb(99,102,241) 12%, rgb(129,140,248) 25%, transparent 45%, transparent 65%, rgb(99,102,241) 80%, transparent)",
              opacity: isSpeaking ? 0.5 : 0.18,
              filter: "blur(1.5px)",
            }}
          />
        </div>

        {/* Pulse ring 1 */}
        <div
          className="absolute inset-[-10px] rounded-full border transition-all duration-700"
          style={{
            borderColor: isSpeaking ? "rgba(99,102,241,0.35)" : isListening ? "rgba(251,191,36,0.25)" : "rgba(99,102,241,0.08)",
            borderWidth: "1.5px",
            boxShadow: isSpeaking ? "0 0 24px rgba(99,102,241,0.25), inset 0 0 24px rgba(99,102,241,0.06)" : isThinking ? "0 0 8px rgba(99,102,241,0.1)" : "none",
          }}
        />

        {/* Pulse ring 2 */}
        <div
          className="absolute inset-[-6px] rounded-full border transition-all duration-1000"
          style={{
            borderColor: "rgba(99,102,241,0.12)",
            borderWidth: "1px",
            transform: isSpeaking ? "scale(1.1)" : "scale(1)",
            opacity: isSpeaking ? 0 : 0.4,
          }}
        />

        {/* Second outer ring — thinner, further out */}
        <div
          className="absolute inset-[-18px] rounded-full border transition-all duration-1000"
          style={{
            borderColor: "rgba(99,102,241,0.04)",
            borderWidth: "0.5px",
            opacity: isSpeaking ? 0.5 : 0.2,
          }}
        />

        {/* Central energy core */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="rounded-full transition-all duration-500"
            style={{
              width: isSpeaking ? "72%" : isThinking ? "62%" : "58%",
              height: isSpeaking ? "72%" : isThinking ? "62%" : "58%",
              background: "radial-gradient(circle, rgba(99,102,241,0.18), rgba(99,102,241,0.06) 60%, transparent)",
              boxShadow: isSpeaking
                ? "0 0 35px rgba(99,102,241,0.35), 0 0 70px rgba(99,102,241,0.12)"
                : isThinking ? "0 0 15px rgba(99,102,241,0.15)" : "0 0 8px rgba(99,102,241,0.06)",
            }}
          />
        </div>

        {/* Orbiting particles */}
        {[0, 60, 120, 180, 240, 300].map((angle, i) => (
          <div
            key={i}
            className="absolute inset-0 animate-spin-slow"
            style={{
              animationDuration: `${10 + i * 2}s`,
              animationDirection: i % 2 === 0 ? "normal" : "reverse",
            }}
          >
            <div
              className="absolute rounded-full transition-all duration-500"
              style={{
                width: isSpeaking ? 3.5 : 2,
                height: isSpeaking ? 3.5 : 2,
                top: "50%",
                left: "50%",
                transform: `rotate(${angle}deg) translateY(-${isSpeaking ? 88 : 82}px)`,
                background: i % 2 === 0 ? "rgb(129,140,248)" : "rgb(165,180,252)",
                boxShadow: isSpeaking ? `0 0 8px rgba(129,140,248,0.7)` : "none",
                opacity: isSpeaking ? 0.85 : 0.18,
              }}
            />
          </div>
        ))}

        {/* SVG face */}
        <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
          {/* Head */}
          <circle cx="100" cy="78" r="40" fill="none" stroke="rgb(99,102,241)" strokeWidth="1.8" opacity="0.9">
            {isSpeaking && <animate attributeName="r" values="40;41;40" dur="1.5s" repeatCount="indefinite" />}
          </circle>
          <circle cx="100" cy="78" r="44" fill="none" stroke="rgb(129,140,248)" strokeWidth="0.5" opacity="0.25" />

          {/* Eyes */}
          <circle cx="84" cy="72" r={isSpeaking ? 4.5 : 4} fill="rgb(129,140,248)" opacity="0.9">
            {isSpeaking && <animate attributeName="r" values="4;5;4" dur="1.2s" repeatCount="indefinite" />}
          </circle>
          <circle cx="116" cy="72" r={isSpeaking ? 4.5 : 4} fill="rgb(129,140,248)" opacity="0.9">
            {isSpeaking && <animate attributeName="r" values="4;5;4" dur="1.2s" begin="0.3s" repeatCount="indefinite" />}
          </circle>

          {/* Eye glow rings */}
          <circle cx="84" cy="72" r="9" fill="none" stroke="rgb(165,180,252)" strokeWidth="0.5" opacity={isSpeaking ? 0.45 : 0.08} />
          <circle cx="116" cy="72" r="9" fill="none" stroke="rgb(165,180,252)" strokeWidth="0.5" opacity={isSpeaking ? 0.45 : 0.08} />

          {/* Mouth */}
          <path d="M74 96 Q100 114 126 96" fill="none" stroke="rgb(129,140,248)" strokeWidth="1.5" strokeLinecap="round" opacity="0.8">
            {isSpeaking && (
              <animate attributeName="d" values="M74 96 Q100 114 126 96;M76 94 Q100 110 124 94;M74 96 Q100 114 126 96" dur="0.7s" repeatCount="indefinite" />
            )}
          </path>

          {/* Tech brackets */}
          <path d="M48 78 L56 78 M48 78 L48 86" stroke="rgb(99,102,241)" strokeWidth="1" fill="none" opacity="0.25" />
          <path d="M152 78 L144 78 M152 78 L152 86" stroke="rgb(99,102,241)" strokeWidth="1" fill="none" opacity="0.25" />

          {/* Shoulders */}
          <line x1="100" y1="118" x2="100" y2="126" stroke="rgb(99,102,241)" strokeWidth="1" opacity="0.35" />
          <line x1="72" y1="134" x2="128" y2="134" stroke="rgb(99,102,241)" strokeWidth="1" opacity="0.25" />
          <line x1="80" y1="126" x2="72" y2="134" stroke="rgb(99,102,241)" strokeWidth="0.8" opacity="0.2" />
          <line x1="120" y1="126" x2="128" y2="134" stroke="rgb(99,102,241)" strokeWidth="0.8" opacity="0.2" />

          {/* Listening indicators */}
          {isListening && (
            <>
              <line x1="56" y1="66" x2="48" y2="60" stroke="rgb(251,191,36)" strokeWidth="1.5" opacity="0.7">
                <animate attributeName="opacity" values="0.7;0.15;0.7" dur="0.9s" repeatCount="indefinite" />
              </line>
              <line x1="144" y1="66" x2="152" y2="60" stroke="rgb(251,191,36)" strokeWidth="1.5" opacity="0.7">
                <animate attributeName="opacity" values="0.7;0.15;0.7" dur="0.9s" begin="0.45s" repeatCount="indefinite" />
              </line>
            </>
          )}

          {/* Scanning line when idle */}
          {!isSpeaking && !isListening && (
            <line x1="44" y1="120" x2="156" y2="120" stroke="rgb(99,102,241)" strokeWidth="0.5" opacity="0.1">
              <animate attributeName="y1" values="44;156;44" dur="5s" repeatCount="indefinite" />
              <animate attributeName="y2" values="44;156;44" dur="5s" repeatCount="indefinite" />
            </line>
          )}
        </svg>
      </div>

      {/* Sound wave bars */}
      <div className="flex gap-[3px] items-end justify-center" style={{ height: 40 }}>
        {[5, 12, 20, 28, 36, 28, 20, 12, 5].map((h, i) => (
          <div
            key={i}
            className="w-[3px] rounded-full transition-all duration-200"
            style={{
              height: isSpeaking ? h : 4,
              background: isSpeaking
                ? "linear-gradient(to top, rgb(79,70,229), rgb(99,102,241), rgb(165,180,252))"
                : "rgb(99,102,241)",
              opacity: isSpeaking ? 0.9 : 0.12,
              boxShadow: isSpeaking ? "0 0 10px rgba(99,102,241,0.5)" : "none",
              animation: isSpeaking ? `soundbar 0.6s ease-in-out ${i * 0.07}s infinite` : "none",
            }}
          />
        ))}
      </div>

      {/* Status badge — large and prominent */}
      <div
        className="flex items-center gap-3 px-5 py-2.5 rounded-full border transition-all duration-500"
        style={{
          background: `rgba(15,23,42,0.8)`,
          borderColor: isSpeaking ? "rgba(34,197,94,0.3)" : isListening ? "rgba(251,191,36,0.3)" : isThinking ? "rgba(99,102,241,0.25)" : "rgba(100,116,139,0.2)",
          boxShadow: isSpeaking
            ? `0 0 20px rgba(34,197,94,0.15), inset 0 0 20px rgba(34,197,94,0.03)`
            : isThinking
              ? `0 0 15px rgba(99,102,241,0.12), inset 0 0 15px rgba(99,102,241,0.03)`
              : "none",
          backdropFilter: "blur(8px)",
        }}
      >
        <span
          className="w-[10px] h-[10px] rounded-full shrink-0"
          style={{
            background: statusColor,
            boxShadow: `0 0 ${isSpeaking ? "12px" : "8px"} ${statusColor}`,
            animation: (isSpeaking || isListening || isThinking) ? "statusPulse 1.5s ease-in-out infinite" : "none",
          }}
        />
        <span
          className="text-sm font-semibold tracking-widest uppercase"
          style={{
            color: statusColor,
            textShadow: isSpeaking ? `0 0 16px ${statusColor}` : "none",
          }}
        >
          {statusLabel}
        </span>
      </div>

      <style>{`
        @keyframes soundbar {
          0%, 100% { transform: scaleY(0.25); }
          50% { transform: scaleY(1.2); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow linear infinite;
        }
        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
