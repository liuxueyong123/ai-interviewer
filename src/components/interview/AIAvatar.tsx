"use client";

interface AIAvatarProps {
  state: "idle" | "speaking" | "listening" | "thinking";
}

export default function AIAvatar({ state }: AIAvatarProps) {
  const isSpeaking = state === "speaking";
  const isListening = state === "listening";
  const isThinking = state === "thinking";

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5">
      {/* Main avatar area */}
      <div className="relative" style={{ width: 180, height: 180 }}>
        {/* Dot matrix background */}
        <div className="absolute inset-0 opacity-15" style={{
          backgroundImage: "radial-gradient(circle, rgb(99,102,241) 1px, transparent 1px)",
          backgroundSize: "12px 12px",
        }} />

        {/* Outer rotating ring */}
        <div className="absolute inset-[-4px] rounded-full">
          <div
            className="w-full h-full rounded-full animate-spin-slow"
            style={{
              background: "conic-gradient(from 0deg, transparent, rgb(99,102,241) 15%, rgb(129,140,248) 30%, transparent 50%, transparent 70%, rgb(99,102,241) 85%, transparent)",
              opacity: isSpeaking ? 0.5 : 0.2,
              filter: "blur(1px)",
            }}
          />
        </div>

        {/* Pulse ring 1 */}
        <div
          className="absolute inset-[-8px] rounded-full border transition-all duration-700"
          style={{
            borderColor: isSpeaking ? "rgba(99,102,241,0.35)" : isListening ? "rgba(251,191,36,0.25)" : "rgba(99,102,241,0.1)",
            borderWidth: "1.5px",
            boxShadow: isSpeaking ? "0 0 20px rgba(99,102,241,0.2), inset 0 0 20px rgba(99,102,241,0.05)" : "none",
          }}
        />

        {/* Pulse ring 2 — expanding */}
        <div
          className="absolute inset-[-4px] rounded-full border transition-all duration-1000"
          style={{
            borderColor: "rgba(99,102,241,0.15)",
            borderWidth: "1px",
            transform: isSpeaking ? "scale(1.08)" : "scale(1)",
            opacity: isSpeaking ? 0 : 0.5,
          }}
        />

        {/* Central energy core */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="rounded-full transition-all duration-500"
            style={{
              width: isSpeaking ? "70%" : isThinking ? "60%" : "55%",
              height: isSpeaking ? "70%" : isThinking ? "60%" : "55%",
              background: "radial-gradient(circle, rgba(99,102,241,0.15), rgba(99,102,241,0.05), transparent)",
              boxShadow: isSpeaking
                ? "0 0 30px rgba(99,102,241,0.3), 0 0 60px rgba(99,102,241,0.1)"
                : "0 0 10px rgba(99,102,241,0.08)",
            }}
          />
        </div>

        {/* Orbiting particles */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
          <div
            key={i}
            className="absolute inset-0 animate-spin-slow"
            style={{
              animationDuration: `${8 + i * 1.5}s`,
              animationDirection: i % 2 === 0 ? "normal" : "reverse",
            }}
          >
            <div
              className="absolute rounded-full transition-all duration-500"
              style={{
                width: isSpeaking ? 3 : 2,
                height: isSpeaking ? 3 : 2,
                top: "50%",
                left: "50%",
                transform: `rotate(${angle}deg) translateY(-${isSpeaking ? 82 : 78}px)`,
                background: i % 3 === 0 ? "rgb(129,140,248)" : i % 3 === 1 ? "rgb(99,102,241)" : "rgb(165,180,252)",
                boxShadow: isSpeaking ? "0 0 6px rgba(99,102,241,0.6)" : "none",
                opacity: isSpeaking ? 0.8 : 0.2,
              }}
            />
          </div>
        ))}

        {/* SVG face — geometric wireframe */}
        <svg viewBox="0 0 180 180" className="absolute inset-0 w-full h-full">
          {/* Head circle */}
          <circle cx="90" cy="72" r="38" fill="none" stroke="rgb(99,102,241)" strokeWidth="1.5" opacity="0.9">
            {isSpeaking && <animate attributeName="r" values="38;39;38" dur="1.5s" repeatCount="indefinite" />}
          </circle>

          {/* Inner head ring */}
          <circle cx="90" cy="72" r="42" fill="none" stroke="rgb(129,140,248)" strokeWidth="0.5" opacity="0.3" />

          {/* Eyes */}
          <circle cx="76" cy="66" r={isSpeaking ? 4 : 3.5} fill="rgb(129,140,248)" opacity="0.9">
            {isSpeaking && <animate attributeName="r" values="3.5;4.5;3.5" dur="1.2s" repeatCount="indefinite" />}
          </circle>
          <circle cx="104" cy="66" r={isSpeaking ? 4 : 3.5} fill="rgb(129,140,248)" opacity="0.9">
            {isSpeaking && <animate attributeName="r" values="3.5;4.5;3.5" dur="1.2s" begin="0.3s" repeatCount="indefinite" />}
          </circle>

          {/* Eye glow */}
          <circle cx="76" cy="66" r="8" fill="none" stroke="rgb(165,180,252)" strokeWidth="0.5" opacity={isSpeaking ? 0.4 : 0.1} />
          <circle cx="104" cy="66" r="8" fill="none" stroke="rgb(165,180,252)" strokeWidth="0.5" opacity={isSpeaking ? 0.4 : 0.1} />

          {/* Mouth */}
          <path d="M68 88 Q90 104 112 88" fill="none" stroke="rgb(129,140,248)" strokeWidth="1.5" strokeLinecap="round" opacity="0.8">
            {isSpeaking && (
              <animate attributeName="d" values="M68 88 Q90 104 112 88;M70 86 Q90 100 110 86;M68 88 Q90 104 112 88" dur="0.8s" repeatCount="indefinite" />
            )}
          </path>

          {/* Decorative tech brackets */}
          <path d="M40 72 L48 72 M40 72 L40 80" stroke="rgb(99,102,241)" strokeWidth="1" fill="none" opacity="0.3" />
          <path d="M140 72 L132 72 M140 72 L140 80" stroke="rgb(99,102,241)" strokeWidth="1" fill="none" opacity="0.3" />

          {/* Shoulders — geometric lines */}
          <line x1="90" y1="110" x2="90" y2="118" stroke="rgb(99,102,241)" strokeWidth="1" opacity="0.4" />
          <line x1="64" y1="126" x2="116" y2="126" stroke="rgb(99,102,241)" strokeWidth="1" opacity="0.3" />
          <line x1="72" y1="118" x2="64" y2="126" stroke="rgb(99,102,241)" strokeWidth="0.8" opacity="0.25" />
          <line x1="108" y1="118" x2="116" y2="126" stroke="rgb(99,102,241)" strokeWidth="0.8" opacity="0.25" />

          {/* Listening indicators */}
          {isListening && (
            <>
              <line x1="50" y1="60" x2="44" y2="56" stroke="rgb(251,191,36)" strokeWidth="1.5" opacity="0.7">
                <animate attributeName="opacity" values="0.7;0.2;0.7" dur="1s" repeatCount="indefinite" />
              </line>
              <line x1="130" y1="60" x2="136" y2="56" stroke="rgb(251,191,36)" strokeWidth="1.5" opacity="0.7">
                <animate attributeName="opacity" values="0.7;0.2;0.7" dur="1s" begin="0.5s" repeatCount="indefinite" />
              </line>
            </>
          )}

          {/* Scanning line when idle */}
          {!isSpeaking && !isListening && (
            <line x1="40" y1="120" x2="140" y2="120" stroke="rgb(99,102,241)" strokeWidth="0.5" opacity="0.12">
              <animate attributeName="y1" values="40;140;40" dur="4s" repeatCount="indefinite" />
              <animate attributeName="y2" values="40;140;40" dur="4s" repeatCount="indefinite" />
            </line>
          )}
        </svg>
      </div>

      {/* Sound wave bars */}
      <div className="flex gap-[3px] items-end justify-center" style={{ height: 36 }}>
        {[6, 14, 22, 32, 22, 14, 6].map((h, i) => (
          <div
            key={i}
            className="w-[3px] rounded-full transition-all duration-200"
            style={{
              height: isSpeaking ? h : 4,
              background: isSpeaking
                ? "linear-gradient(to top, rgb(99,102,241), rgb(165,180,252))"
                : "rgb(99,102,241)",
              opacity: isSpeaking ? 0.9 : 0.15,
              boxShadow: isSpeaking ? "0 0 8px rgba(99,102,241,0.5)" : "none",
              animation: isSpeaking ? `soundbar 0.65s ease-in-out ${i * 0.08}s infinite` : "none",
            }}
          />
        ))}
      </div>

      {/* Status with glow */}
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full transition-all duration-500"
          style={{
            background: isSpeaking ? "rgb(34,197,94)" : isListening ? "rgb(251,191,36)" : isThinking ? "rgb(99,102,241)" : "rgb(100,116,139)",
            boxShadow: isSpeaking ? "0 0 6px rgb(34,197,94)" : isListening ? "0 0 6px rgb(251,191,36)" : isThinking ? "0 0 6px rgb(99,102,241)" : "none",
          }}
        />
        <span
          className="text-[11px] tracking-wider uppercase font-medium transition-all duration-500"
          style={{
            color: isSpeaking ? "rgb(34,197,94)" : isListening ? "rgb(251,191,36)" : isThinking ? "rgb(129,140,248)" : "rgb(148,163,184)",
            textShadow: isSpeaking ? "0 0 10px rgba(34,197,94,0.3)" : "none",
          }}
        >
          {isSpeaking ? "Speaking" : isListening ? "Listening" : isThinking ? "Thinking" : "Ready"}
        </span>
      </div>

      <style>{`
        @keyframes soundbar {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1.15); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow linear infinite;
        }
      `}</style>
    </div>
  );
}
