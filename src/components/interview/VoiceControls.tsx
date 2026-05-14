"use client";

interface VoiceControlsProps {
  state: "idle" | "waiting" | "recording" | "processing";
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
}

export default function VoiceControls({ state, onStart, onStop, disabled: externalDisabled }: VoiceControlsProps) {
  const isRecording = state === "recording";
  const isProcessing = state === "processing";
  const isWaiting = state === "waiting";
  const disabled = externalDisabled || state === "idle" || isProcessing;

  return (
    <div className="flex items-center justify-center py-3 shrink-0">
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={isRecording ? onStop : onStart}
          disabled={disabled}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
            isRecording
              ? "bg-red-500 shadow-[0_0_0_6px_rgba(239,68,68,0.2)]"
              : isWaiting
                ? "bg-red-500 shadow-[0_0_0_6px_rgba(239,68,68,0.2)] animate-pulse"
                : isProcessing
                  ? "bg-slate-600"
                  : "bg-slate-600 opacity-50"
          } disabled:cursor-not-allowed`}
        >
          {isRecording ? (
            <div className="w-5 h-5 bg-white rounded-sm" />
          ) : isProcessing ? (
            <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>
        <span className="text-xs text-slate-400">
          {isRecording ? "点击结束回答" : isProcessing ? "思考中..." : isWaiting ? "点击开始回答" : ""}
        </span>
      </div>
    </div>
  );
}
