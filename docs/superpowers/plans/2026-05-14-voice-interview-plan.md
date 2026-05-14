# Voice Interview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add voice-based interview mode with TTS-spoken AI questions, split-screen video-call UI, and manual push-to-talk recording.

**Architecture:** Reuse existing `/api/chat` SSE + `/api/speech` ASR endpoints. Add new `/api/tts` endpoint calling DashScope Qwen3-TTS-VD. New VoiceInterview component orchestrates the conversation loop via a state machine. New `/interview/voice` page with dark-themed split-screen layout.

**Tech Stack:** Next.js 16 App Router, TypeScript, DashScope Qwen3-TTS-VD API, MediaRecorder API, getUserMedia, SVG/CSS animation

---

## File Structure

```
New files:
  src/app/api/tts/route.ts                  — TTS endpoint
  src/hooks/useTTS.ts                        — Audio playback hook
  src/app/interview/voice/page.tsx           — Voice interview route
  src/components/interview/VoiceInterview.tsx — State machine orchestrator
  src/components/interview/AIAvatar.tsx       — SVG face + animations
  src/components/interview/CameraPreview.tsx  — Local camera feed
  src/components/interview/SubtitleBar.tsx    — Animated subtitles
  src/components/interview/VoiceControls.tsx  — Record/mute buttons
  scripts/create-voice.ts                    — One-time voice design

Modified files:
  src/lib/validations.ts                     — ttsSchema, mode in createInterviewSchema
  src/entities/Interview.ts                  — mode column
  src/app/api/interviews/route.ts            — mode in POST
  src/components/interview/SetupForm.tsx      — mode selector
  src/components/chat/ChatContainer.tsx       — TTS speaker button (optional)
  CLAUDE.md                                  — env var docs
```

---

### Task 1: Add TTS validation schema and env documentation

**Files:**
- Modify: `src/lib/validations.ts`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add ttsSchema**

Add after the chatSchema block in `src/lib/validations.ts`:

```typescript
// ── TTS ──
export const ttsSchema = z.object({
  text: z.string().min(1, "文本不能为空").max(600, "文本过长"),
});
```

In the `createInterviewSchema`, add `mode` field after `maxRounds`:

```typescript
mode: z.enum(["text", "voice"]).optional(),
```

- [ ] **Step 2: Update CLAUDE.md**

Add to the env var table:

```
| `DASHSCOPE_TTS_VOICE_ID`           | TTS 音色 ID（通过 voice design 创建）           |
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/validations.ts CLAUDE.md
git commit -m "chore: add ttsSchema, mode field, and TTS env var docs"
```

---

### Task 2: Create TTS API endpoint

**Files:**
- Create: `src/app/api/tts/route.ts`

- [ ] **Step 1: Write the TTS endpoint**

Create `src/app/api/tts/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getUserId } from "@/lib/utils";
import { validate, ttsSchema } from "@/lib/validations";

const DASHSCOPE_BASE_URL = process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/api/v1";
const TTS_VOICE_ID = process.env.DASHSCOPE_TTS_VOICE_ID;

export async function POST(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  if (!TTS_VOICE_ID) {
    logger.error("TTS voice_id not configured");
    return NextResponse.json({ error: "TTS 未配置" }, { status: 500 });
  }

  let body: { text: string };
  try {
    body = validate(ttsSchema, await request.json());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  logger.info("TTS request", { userId, textLen: body.text.length });

  try {
    const res = await fetch(`${DASHSCOPE_BASE_URL}/services/aigc/multimodal-generation/generation`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.DASHSCOPE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen3-tts-vd-2026-01-26",
        input: {
          text: body.text,
          voice: TTS_VOICE_ID,
          language_type: "Chinese",
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      logger.error("DashScope TTS error", { status: res.status, error: errText });
      return NextResponse.json({ error: "语音合成失败" }, { status: 502 });
    }

    const data = await res.json();
    const audioUrl = data?.output?.audio?.url;

    if (!audioUrl) {
      logger.error("TTS response missing audio URL");
      return NextResponse.json({ error: "语音合成失败" }, { status: 502 });
    }

    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      logger.error("TTS audio download failed", { status: audioRes.status });
      return NextResponse.json({ error: "语音合成失败" }, { status: 502 });
    }

    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    const base64 = audioBuffer.toString("base64");
    const dataUri = `data:audio/wav;base64,${base64}`;

    return NextResponse.json({ audio: dataUri });
  } catch (err) {
    logger.error("TTS unexpected error", { error: String(err) });
    return NextResponse.json({ error: "语音合成失败" }, { status: 502 });
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep -i "tts" || echo "No TTS errors"`
Expected: No TTS-related errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tts/route.ts
git commit -m "feat: add TTS API endpoint with DashScope Qwen3-TTS-VD"
```

---

### Task 3: Create useTTS hook

**Files:**
- Create: `src/hooks/useTTS.ts`

- [ ] **Step 1: Write the useTTS hook**

Create `src/hooks/useTTS.ts`:

```typescript
"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type TTSState = "idle" | "loading" | "playing" | "error";

export function useTTS() {
  const [state, setState] = useState<TTSState>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setState("idle");
  }, []);

  const speak = useCallback(async (text: string): Promise<void> => {
    stop();

    const abort = new AbortController();
    abortRef.current = abort;
    setState("loading");

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "TTS 请求失败");
      }

      const data = await res.json();
      if (!data.audio) throw new Error("TTS 响应缺少音频");

      return new Promise<void>((resolve, reject) => {
        const audio = new Audio(data.audio);
        audioRef.current = audio;

        audio.onplay = () => setState("playing");
        audio.onended = () => {
          setState("idle");
          audioRef.current = null;
          resolve();
        };
        audio.onerror = () => {
          setState("error");
          audioRef.current = null;
          reject(new Error("音频播放失败"));
        };

        audio.play().catch((e) => {
          setState("error");
          audioRef.current = null;
          reject(e);
        });
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState("error");
      throw err;
    } finally {
      abortRef.current = null;
    }
  }, [stop]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { speak, stop, state };
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep -i "useTTS" || echo "No useTTS errors"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTTS.ts
git commit -m "feat: add useTTS hook for text-to-speech playback"
```

---

### Task 4: Add Interview mode column

**Files:**
- Modify: `src/entities/Interview.ts`
- Modify: `src/app/api/interviews/route.ts`

- [ ] **Step 1: Add mode column to Interview entity**

In `src/entities/Interview.ts`, add after the `maxRounds` column definition:

```typescript
@Column({ type: "varchar", length: 10, default: "text" })
mode: "text" | "voice";
```

- [ ] **Step 2: Update interview creation API**

In `src/app/api/interviews/route.ts`, update the destructure (line 57) to include mode:

```typescript
let { position, resumeText, resumeId, questionCount = 12, difficulty = "mid", maxRounds = 2, mode } = body;
```

Update the `create` call (around line 97) to include mode:

```typescript
const interview = ds.getRepository(Interview).create({
  user: { id: userId },
  position,
  title,
  resumeText: finalResumeText,
  status: "ongoing",
  questionCount,
  difficulty,
  currentRound: 1,
  maxRounds,
  mode: mode || "text",
});
```

Update the response (around line 120):

```typescript
return NextResponse.json({ interviewId: interview.id, mode: mode || "text" });
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/entities/Interview.ts src/app/api/interviews/route.ts
git commit -m "feat: add interview mode column (text/voice)"
```

---

### Task 5: Create AIAvatar component

**Files:**
- Create: `src/components/interview/AIAvatar.tsx`

- [ ] **Step 1: Write AIAvatar component**

Create `src/components/interview/AIAvatar.tsx`:

```typescript
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
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep -i "AIAvatar" || echo "No AIAvatar errors"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/interview/AIAvatar.tsx
git commit -m "feat: add AIAvatar component with SVG face and sound wave animation"
```

---

### Task 6: Create CameraPreview component

**Files:**
- Create: `src/components/interview/CameraPreview.tsx`

- [ ] **Step 1: Write CameraPreview component**

Create `src/components/interview/CameraPreview.tsx`:

```typescript
"use client";

import { useEffect, useRef, useState } from "react";

export default function CameraPreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      })
      .catch(() => setError(true));

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
        <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <p className="text-xs">摄像头不可用</p>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover rounded-xl"
        style={{ transform: "scaleX(-1)" }}
      />
      <div className="absolute bottom-2 left-2 text-[10px] text-white/40 bg-black/30 px-2 py-0.5 rounded">
        仅本地，不传输
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep -i "CameraPreview" || echo "No CameraPreview errors"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/interview/CameraPreview.tsx
git commit -m "feat: add CameraPreview with local getUserMedia feed"
```

---

### Task 7: Create SubtitleBar component

**Files:**
- Create: `src/components/interview/SubtitleBar.tsx`

- [ ] **Step 1: Write SubtitleBar component**

Create `src/components/interview/SubtitleBar.tsx`:

```typescript
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
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep -i "SubtitleBar" || echo "No SubtitleBar errors"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/interview/SubtitleBar.tsx
git commit -m "feat: add SubtitleBar component with fade-in animation"
```

---

### Task 8: Create VoiceControls component

**Files:**
- Create: `src/components/interview/VoiceControls.tsx`

- [ ] **Step 1: Write VoiceControls component**

Create `src/components/interview/VoiceControls.tsx`:

```typescript
"use client";

interface VoiceControlsProps {
  state: "idle" | "waiting" | "recording" | "processing";
  onStart: () => void;
  onStop: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

export default function VoiceControls({ state, onStart, onStop, muted, onToggleMute }: VoiceControlsProps) {
  const isRecording = state === "recording";
  const isProcessing = state === "processing";
  const isWaiting = state === "waiting";
  const disabled = state === "idle" || isProcessing;

  return (
    <div className="flex items-center justify-center gap-8 py-3 shrink-0">
      {/* Mute button */}
      <button
        type="button"
        onClick={onToggleMute}
        className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
        title={muted ? "取消静音" : "静音"}
      >
        {muted ? (
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l2.5-2.25a.75.75 0 011.25.56v13.88a.75.75 0 01-1.25.56l-2.5-2.25H5.25a1.5 1.5 0 01-1.5-1.5v-7.5a1.5 1.5 0 011.5-1.5H9z" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.5-4.5a.75.75 0 011.25.56v15.38a.75.75 0 01-1.25.56l-4.5-4.5H4.5a1.5 1.5 0 01-1.5-1.5v-4.5A1.5 1.5 0 014.5 8.25h2.25z" />
          </svg>
        )}
      </button>

      {/* Record button */}
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

      {/* Spacer for symmetry */}
      <div className="w-10" />
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep -i "VoiceControls" || echo "No VoiceControls errors"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/interview/VoiceControls.tsx
git commit -m "feat: add VoiceControls with record/mute buttons"
```

---

### Task 9: Create VoiceInterview state machine

**Files:**
- Create: `src/components/interview/VoiceInterview.tsx`

- [ ] **Step 1: Write VoiceInterview orchestrator**

Create `src/components/interview/VoiceInterview.tsx`:

```typescript
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { EventSourceParserStream } from "eventsource-parser/stream";
import { toast } from "@/components/ui/Toast";
import { useTTS } from "@/hooks/useTTS";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import AIAvatar from "./AIAvatar";
import CameraPreview from "./CameraPreview";
import SubtitleBar from "./SubtitleBar";
import VoiceControls from "./VoiceControls";

type AppState = "idle" | "ai_speaking" | "waiting_for_user" | "user_speaking" | "processing" | "finished";

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function VoiceInterview() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const interviewId = searchParams.get("id");

  const [appState, setAppState] = useState<AppState>("idle");
  const [subtitle, setSubtitle] = useState("");
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [muted, setMuted] = useState(false);
  const [position, setPosition] = useState("");
  const [currentRound, setCurrentRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(1);
  const [questionCount, setQuestionCount] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const { speak, stop: stopTTS } = useTTS();
  const abortRef = useRef<AbortController | null>(null);
  const lastRecognizedRef = useRef("");

  const handleVoiceResult = useCallback((text: string) => {
    lastRecognizedRef.current = text;
  }, []);
  const handleVoiceError = useCallback((err: string) => {
    toast.warning(err);
  }, []);
  const { startListening, stopListening } = useSpeechRecognition(handleVoiceResult, handleVoiceError);

  // Timer
  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startTime.getTime()) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  // Leave confirmation
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Load interview history
  useEffect(() => {
    if (!interviewId) return;
    fetch(`/api/interviews/${interviewId}`)
      .then((res) => res.json())
      .then((data) => {
        setPosition(data.interview?.position ?? "");
        setCurrentRound(data.interview?.currentRound ?? 1);
        setMaxRounds(data.interview?.maxRounds ?? 1);

        const roundMessages = (data.messages || []).filter(
          (m: { round: number }) => m.round === (data.interview?.currentRound ?? 1)
        );
        const interviewerMessages = roundMessages.filter((m: { role: string }) => m.role === "interviewer");
        setQuestionCount(interviewerMessages.length);

        if (data.interview?.status === "done" || data.interview?.status === "evaluating") {
          setAppState("finished");
          return;
        }

        if (interviewerMessages.length > 0) {
          const lastMsg = interviewerMessages[interviewerMessages.length - 1];
          setSubtitle(lastMsg.content);
          setShowSubtitle(true);
          setAppState("ai_speaking");
          speak(lastMsg.content).then(() => {
            setAppState("waiting_for_user");
          }).catch(() => {
            setAppState("waiting_for_user");
          });
        }

        const storageKey = `interview_timer_${interviewId}_round_${data.interview?.currentRound ?? 1}`;
        let roundStart = localStorage.getItem(storageKey);
        if (!roundStart) {
          roundStart = String(Date.now());
          localStorage.setItem(storageKey, roundStart);
        }
        setStartTime(new Date(parseInt(roundStart, 10)));
      })
      .catch(() => {});
  }, [interviewId, speak]);

  // Send user message to chat and get AI response
  const sendToChat = useCallback(async (userMsg: string) => {
    if (!interviewId) return;
    setAppState("processing");
    setShowSubtitle(false);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId: parseInt(interviewId, 10), message: userMsg }),
        signal: abort.signal,
      });
      if (!res.ok) throw new Error(`请求失败 (${res.status})`);

      const eventStream = res.body!
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream());
      const reader = eventStream.getReader();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        try {
          const event = JSON.parse(value.data);
          if (event.type === "chunk") {
            fullContent += event.content;
            setSubtitle(fullContent);
            setShowSubtitle(true);
          } else if (event.type === "done") {
            setQuestionCount(event.questionNumber);
            if (fullContent.includes("面试环节已结束")) {
              finishInterview();
              return;
            }
          }
        } catch { /* skip malformed events */ }
      }

      setAppState("ai_speaking");
      try {
        await speak(fullContent);
      } catch {
        // TTS failed — subtitle still visible
      }
      setAppState("waiting_for_user");
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        toast.error((err as Error).message || "网络错误");
        setAppState("waiting_for_user");
      }
    } finally {
      abortRef.current = null;
    }
  }, [interviewId, speak]);

  // Manual recording controls
  const handleStartRecording = useCallback(() => {
    lastRecognizedRef.current = "";
    startListening();
    setAppState("user_speaking");
  }, [startListening]);

  const handleStopRecording = useCallback(async () => {
    stopListening();
    setAppState("processing");

    // Wait for ASR result (useSpeechRecognition calls onResult when done)
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 200));
      if (lastRecognizedRef.current) break;
    }

    const recognized = lastRecognizedRef.current;
    if (!recognized) {
      toast.warning("未识别到语音，请重试");
      setAppState("waiting_for_user");
      return;
    }

    await sendToChat(recognized);
  }, [stopListening, sendToChat]);

  async function finishInterview() {
    if (!interviewId || finishing) return;
    setFinishing(true);
    setAppState("finished");
    const res = await fetch(`/api/interviews/${interviewId}/finish`, { method: "POST" });
    if (res.ok) {
      router.push(`/results/${interviewId}`);
    } else {
      toast.error("结束面试失败");
      setFinishing(false);
    }
  }

  function handleEndClick() {
    if (!window.confirm("确定要结束当前面试吗？")) return;
    finishInterview();
  }

  const avatarState =
    appState === "ai_speaking" ? "speaking" :
    appState === "user_speaking" ? "listening" :
    appState === "processing" ? "thinking" : "idle";

  const controlsState =
    appState === "ai_speaking" || appState === "idle" ? "idle" :
    appState === "waiting_for_user" ? "waiting" :
    appState === "user_speaking" ? "recording" :
    appState === "processing" ? "processing" : "idle";

  return (
    <div className="h-screen flex flex-col bg-[#0b1120] text-white">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 shrink-0">
        <span className="text-xs text-slate-400">AI 面试 · {position}</span>
        <div className="flex items-center gap-3">
          {maxRounds > 1 && (
            <span className="text-[10px] text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
              第 {currentRound}/{maxRounds} 轮
            </span>
          )}
          <span className="text-xs text-slate-500 tabular-nums font-mono">{formatElapsed(elapsedSeconds)}</span>
          <button
            onClick={handleEndClick}
            disabled={finishing}
            className="text-[10px] px-2.5 py-1 bg-red-500/10 text-red-400 rounded-md hover:bg-red-500/20 transition-colors"
          >
            结束面试
          </button>
        </div>
      </div>

      {/* Split View */}
      <div className="flex-1 flex gap-3 p-3 min-h-0">
        {/* AI Avatar panel */}
        <div className="flex-1 bg-slate-900/50 rounded-2xl flex flex-col border border-white/5">
          <div className="px-3 py-2 text-xs text-indigo-400 font-medium shrink-0">AI 面试官</div>
          <div className="flex-1 flex items-center justify-center">
            <AIAvatar state={avatarState} />
          </div>
        </div>

        {/* User camera panel */}
        <div className="flex-1 bg-black/40 rounded-2xl flex flex-col border border-white/5 overflow-hidden">
          <div className="px-3 py-2 text-xs text-slate-500 font-medium shrink-0">你</div>
          <div className="flex-1">
            <CameraPreview />
          </div>
        </div>
      </div>

      {/* Subtitle */}
      <SubtitleBar text={subtitle} visible={showSubtitle} />

      {/* Voice Controls */}
      {appState !== "finished" && (
        <VoiceControls
          state={controlsState}
          onStart={handleStartRecording}
          onStop={handleStopRecording}
          muted={muted}
          onToggleMute={() => setMuted(!muted)}
        />
      )}

      {/* Finished state */}
      {appState === "finished" && (
        <div className="text-center py-4 shrink-0 border-t border-white/5">
          <p className="text-green-400 text-sm font-medium mb-2">面试已完成</p>
          <button
            onClick={() => router.push(`/results/${interviewId}`)}
            className="text-sm px-4 py-2 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600 transition-colors"
          >
            查看评分报告
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors from VoiceInterview.tsx

- [ ] **Step 3: Commit**

```bash
git add src/components/interview/VoiceInterview.tsx
git commit -m "feat: add VoiceInterview state machine orchestrator"
```

---

### Task 10: Create voice interview page route

**Files:**
- Create: `src/app/interview/voice/page.tsx`

- [ ] **Step 1: Write the page**

Create `src/app/interview/voice/page.tsx`:

```typescript
import { Suspense } from "react";
import VoiceInterview from "@/components/interview/VoiceInterview";

export default function VoiceChatPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-[#0b1120] text-slate-400">
        加载中...
      </div>
    }>
      <VoiceInterview />
    </Suspense>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/interview/voice/page.tsx
git commit -m "feat: add voice interview page route at /interview/voice"
```

---

### Task 11: Update SetupForm with mode selector

**Files:**
- Modify: `src/components/interview/SetupForm.tsx`

- [ ] **Step 1: Add mode state and UI**

Add state after `difficulty` state:

```typescript
const [mode, setMode] = useState<"text" | "voice">("text");
```

Add mode selector UI before the error display (before the `{error && ...}` block):

```typescript
{/* Mode selector */}
<div className="col-span-2">
  <label className="block text-sm font-medium text-text-secondary mb-2">面试模式</label>
  <div className="grid grid-cols-2 gap-3">
    <button
      type="button"
      onClick={() => setMode("text")}
      className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
        mode === "text" ? "border-accent bg-accent-muted" : "border-border bg-surface-1 hover:border-text-muted"
      }`}
    >
      <div className={`text-sm font-semibold mb-1 ${mode === "text" ? "text-accent" : "text-text-primary"}`}>
        文字面试
      </div>
      <div className="text-xs text-text-muted">聊天对话 · 键盘输入</div>
    </button>
    <button
      type="button"
      onClick={() => setMode("voice")}
      className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
        mode === "voice" ? "border-accent bg-accent-muted" : "border-border bg-surface-1 hover:border-text-muted"
      }`}
    >
      <div className={`text-sm font-semibold mb-1 ${mode === "voice" ? "text-accent" : "text-text-primary"}`}>
        语音面试
      </div>
      <div className="text-xs text-text-muted">视频通话 · 语音对话</div>
    </button>
  </div>
</div>
```

Update `handleStart`:

```typescript
async function handleStart() {
  if (!position) { setError("请选择目标岗位"); return; }
  if (!selectedResumeId) { setError("请选择一份简历"); return; }
  setLoading(true);
  const res = await fetch("/api/interviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ position, resumeId: selectedResumeId, questionCount, maxRounds, difficulty, mode }),
  });
  const data = await res.json();
  setLoading(false);
  if (!res.ok) { setError(data.error); return; }
  const targetPath = mode === "voice" ? `/interview/voice?id=${data.interviewId}` : `/interview/chat?id=${data.interviewId}`;
  router.push(targetPath);
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/interview/SetupForm.tsx
git commit -m "feat: add interview mode selector (text/voice) to SetupForm"
```

---

### Task 12: Add TTS speaker button to text chat

**Files:**
- Modify: `src/components/chat/ChatContainer.tsx`

- [ ] **Step 1: Add TTS playback to interviewer bubbles**

Add import:

```typescript
import { useTTS } from "@/hooks/useTTS";
```

Add hook inside component:

```typescript
const { speak: speakTTS, state: ttsState } = useTTS();
```

Update the contentRender inside the Bubble.List items mapping. Change the interviewer contentRender block (around line 285-289) from:

```typescript
...(m.role === "interviewer" && !m.loading
  ? {
      contentRender: (content: string) => (
        <XMarkdown content={content} streaming={{ hasNextChunk: m.streaming ?? false, enableAnimation: true }} />
      ),
    }
  : {}),
```

To:

```typescript
...(m.role === "interviewer" && !m.loading
  ? {
      contentRender: (content: string) => (
        <div>
          <XMarkdown content={content} streaming={{ hasNextChunk: m.streaming ?? false, enableAnimation: true }} />
          {!m.streaming && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); speakTTS(content); }}
              disabled={ttsState === "loading"}
              className="inline-flex items-center gap-1 mt-2 text-xs text-text-muted hover:text-accent transition-colors"
              title="播放语音"
            >
              {ttsState === "loading" ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.5-4.5a.75.75 0 011.25.56v15.38a.75.75 0 01-1.25.56l-4.5-4.5H4.5a1.5 1.5 0 01-1.5-1.5v-4.5A1.5 1.5 0 014.5 8.25h2.25z" />
                </svg>
              )}
              <span>播放</span>
            </button>
          )}
        </div>
      ),
    }
  : {}),
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/ChatContainer.tsx
git commit -m "feat: add TTS speaker button to interviewer chat bubbles"
```

---

### Task 13: Create voice design setup script

**Files:**
- Create: `scripts/create-voice.ts`

- [ ] **Step 1: Write the voice design script**

Create `scripts/create-voice.ts`:

```typescript
/**
 * One-time script: create a custom voice via DashScope Voice Design API.
 *
 * Usage:
 *   DASHSCOPE_API_KEY=xxx npx tsx scripts/create-voice.ts
 *
 * Outputs the voice_id to store as DASHSCOPE_TTS_VOICE_ID env var.
 */

const DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/api/v1";
const API_KEY = process.env.DASHSCOPE_API_KEY;

if (!API_KEY) {
  console.error("Error: DASHSCOPE_API_KEY environment variable is required");
  process.exit(1);
}

async function main() {
  console.log("Creating custom interviewer voice...");

  const res = await fetch(`${DASHSCOPE_BASE_URL}/services/audio/tts/customization`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "qwen-voice-design",
      input: {
        action: "create",
        voice_prompt: "温暖沉稳的中年男声，语速适中，专业且有亲和力，适合面试场景",
        preview_text: "同学你好，欢迎参加今天的面试，请先简单介绍一下自己。",
        target_model: "qwen3-tts-vd-2026-01-26",
        preferred_name: "interviewer_male",
      },
      parameters: {
        sample_rate: 24000,
        response_format: "wav",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Voice design failed (${res.status}):`, errText);
    process.exit(1);
  }

  const data = await res.json();
  const voiceId = data?.output?.voice_id;

  if (!voiceId) {
    console.error("No voice_id in response:", JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log("\n✅ Voice created successfully!");
  console.log(`   voice_id: ${voiceId}`);
  console.log("\nAdd this to your .env file:");
  console.log(`   DASHSCOPE_TTS_VOICE_ID=${voiceId}`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
git add scripts/create-voice.ts
git commit -m "feat: add voice design setup script for Qwen3-TTS-VD"
```

---

### Task 14: Final verification

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit 2>&1`
Expected: No errors

- [ ] **Step 2: Build check**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 3: Fix any remaining issues and commit**

```bash
git status
# If clean, done. If fixes were needed:
git add -A && git commit -m "chore: fix build issues for voice interview feature"
```
