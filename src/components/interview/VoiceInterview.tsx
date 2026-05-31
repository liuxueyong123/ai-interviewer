"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { EventSourceParserStream } from "eventsource-parser/stream";
import { toast } from "@/components/ui/Toast";
import { useTTS } from "@/hooks/useTTS";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { createStreamingTextSegmenter } from "@/lib/streamingTextSegmenter";
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
  const [subtitleLoading, setSubtitleLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [position, setPosition] = useState("");
  const [currentRound, setCurrentRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(1);
  const [finishing, setFinishing] = useState(false);

  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const {
    enqueue,
    waitForIdle,
    stop: stopTTS,
    resetMetrics,
    getMetricsSnapshot,
    state: ttsState,
    queueSize,
  } = useTTS({
    maxRetries: 2,
    prefetchLimit: 3,
    onSegmentReady: (text) => {
      setSubtitleLoading(false);
      setSubtitle((prev) => `${prev}${text}`);
    },
    onSegmentError: () => {
      setSubtitleLoading(false);
      setSubtitle(fullContentRef.current);
      setAppState("waiting_for_user");
      toast.warning("语音合成失败，请查看文字继续回答");
    },
  });
  const abortRef = useRef<AbortController | null>(null);
  const lastRecognizedRef = useRef("");
  const fullContentRef = useRef("");
  const stopTTSRef = useRef(stopTTS);
  const initialLoadDone = useRef(false);

  // keep ref in sync
  useEffect(() => {
    stopTTSRef.current = stopTTS;
  }, [stopTTS]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      stopTTSRef.current();
    };
  }, []);

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
    if (appState === "finished") return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [appState]);

  const finishInterview = useCallback(async () => {
    if (!interviewId || finishing) return;
    stopTTS();
    setFinishing(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/finish`, { method: "POST" });
      if (res.ok) {
        setAppState("finished");
        router.push(`/results/${interviewId}`);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || `结束面试失败 (${res.status})`);
        setFinishing(false);
      }
    } catch {
      toast.error("网络错误，请重试");
      setFinishing(false);
    }
  }, [interviewId, finishing, router, stopTTS]);

  // Send user message to chat and get AI response
  const sendToChat = useCallback(
    async (userMsg: string) => {
      if (!interviewId) return;
      setAppState("processing");
      setSubtitle("");
      setSubtitleLoading(false);
      fullContentRef.current = "";
      resetMetrics();

      const abort = new AbortController();
      abortRef.current = abort;

      const segmenter = createStreamingTextSegmenter();
      const chatStartedAt = performance.now();
      let firstChunkAt: number | null = null;
      let fullContent = "";
      let hasQueuedSpeech = false;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interviewId: parseInt(interviewId, 10), message: userMsg }),
          signal: abort.signal,
        });
        if (!res.ok) throw new Error(`请求失败 (${res.status})`);

        const eventStream = res.body!.pipeThrough(new TextDecoderStream()).pipeThrough(new EventSourceParserStream());
        const reader = eventStream.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          try {
            const event = JSON.parse(value.data);
            if (event.type === "chunk") {
              const content = typeof event.content === "string" ? event.content : "";
              if (!content) continue;

              firstChunkAt = firstChunkAt ?? performance.now();
              fullContent += content;
              fullContentRef.current = fullContent;

              const segments = segmenter.push(content);
              for (const segment of segments) {
                enqueue(segment);
                hasQueuedSpeech = true;
              }

              if (hasQueuedSpeech) {
                setSubtitleLoading(true);
                setAppState("ai_speaking");
              }
            } else if (event.type === "done") {
              fullContentRef.current = fullContent;
              const tailSegments = segmenter.flush();
              for (const segment of tailSegments) {
                enqueue(segment);
                hasQueuedSpeech = true;
              }

              if (hasQueuedSpeech) {
                setSubtitleLoading(true);
                setAppState("ai_speaking");
              }
            }
          } catch {
            /* skip malformed events */
          }
        }

        // 如果分句器没有输出任何片段（极短回复等极端情况），兜底入队全文
        if (!hasQueuedSpeech && fullContent.trim()) {
          enqueue(fullContent);
          setSubtitleLoading(true);
          setAppState("ai_speaking");
        }

        await waitForIdle();
        setSubtitleLoading(false);

        const metrics = getMetricsSnapshot();
        const ended = fullContent.includes("面试环节已结束");

        console.info("voice_turn_latency", {
          interviewId,
          chars: fullContent.length,
          segments: metrics.enqueuedCount,
          retries: metrics.retriedCount,
          failedSegments: metrics.failedCount,
          firstTokenMs: firstChunkAt === null ? null : Math.round(firstChunkAt - chatStartedAt),
          firstAudioReadyMs: metrics.firstAudioReadyAt === null ? null : Math.round(metrics.firstAudioReadyAt - chatStartedAt),
          firstPlaybackMs: metrics.firstPlaybackStartedAt === null ? null : Math.round(metrics.firstPlaybackStartedAt - chatStartedAt),
        });

        if (ended) {
          finishInterview();
          return;
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
    },
    [interviewId, enqueue, waitForIdle, resetMetrics, getMetricsSnapshot, finishInterview],
  );

  // Manual recording controls
  const handleStartRecording = useCallback(() => {
    // 解锁 AudioContext（Safari/Firefox 要求首次 play 在用户手势内）
    const unlock = new AudioContext();
    unlock
      .resume()
      .then(() => unlock.close())
      .catch(() => {});
    lastRecognizedRef.current = "";
    startListening();
    setAppState("user_speaking");
  }, [startListening]);

  const handleStopRecording = useCallback(async () => {
    stopListening();
    setAppState("processing");

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

  // Load interview history
  useEffect(() => {
    if (!interviewId || initialLoadDone.current) return;
    initialLoadDone.current = true;

    const abort = new AbortController();
    fetch(`/api/interviews/${interviewId}`, { signal: abort.signal })
      .then((res) => res.json())
      .then((data) => {
        setPosition(data.interview?.position ?? "");
        setCurrentRound(data.interview?.currentRound ?? 1);
        setMaxRounds(data.interview?.maxRounds ?? 1);

        if (data.interview?.status === "done" || data.interview?.status === "evaluating") {
          setAppState("finished");
          return;
        }

        if (data.interview?.mode === "text") {
          router.replace(`/interview/chat?id=${interviewId}`);
          return;
        }

        const roundMessages = (data.messages || []).filter((m: { round: number }) => m.round === (data.interview?.currentRound ?? 1));
        const interviewerMessages = roundMessages.filter((m: { role: string }) => m.role === "interviewer");

        if (interviewerMessages.length > 0) {
          const lastMsg = interviewerMessages[interviewerMessages.length - 1];
          fullContentRef.current = lastMsg.content;
          setLoaded(true);
          setSubtitle("");
          setSubtitleLoading(true);
          setAppState("ai_speaking");
          enqueue(lastMsg.content);
          waitForIdle().finally(() => {
            setSubtitleLoading(false);
            setAppState("waiting_for_user");
          });
        } else {
          setLoaded(true);
        }

        const storageKey = `interview_timer_${interviewId}_round_${data.interview?.currentRound ?? 1}`;
        let roundStart = localStorage.getItem(storageKey);
        if (!roundStart) {
          roundStart = String(Date.now());
          localStorage.setItem(storageKey, roundStart);
        }
        setStartTime(new Date(parseInt(roundStart, 10)));
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") {
          // silently ignore aborted requests
        }
      });

    return () => abort.abort();
  }, [interviewId, enqueue, waitForIdle, router]);

  function handleEndClick() {
    if (!window.confirm("确定要结束当前面试吗？")) return;
    finishInterview();
  }

  const avatarState = !loaded
    ? "thinking"
    : ttsState === "playing"
      ? "speaking"
      : ttsState === "loading" || queueSize > 0
        ? "thinking"
        : appState === "ai_speaking"
          ? "thinking"
          : appState === "user_speaking"
            ? "listening"
            : appState === "processing"
              ? "thinking"
              : "idle";

  const controlsState =
    appState === "ai_speaking" || appState === "idle"
      ? "idle"
      : appState === "waiting_for_user"
        ? "waiting"
        : appState === "user_speaking"
          ? "recording"
          : appState === "processing"
            ? "processing"
            : "idle";

  return (
    <div className="h-screen flex flex-col text-white" style={{ background: "linear-gradient(135deg, #0a0e1a 0%, #1a1040 40%, #0a0e1a 100%)" }}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 shrink-0">
        <span className="text-xs text-text-muted">AI 面试 · {position}</span>
        <div className="flex items-center gap-3">
          {maxRounds > 1 && (
            <span className="text-[10px] text-accent bg-accent-muted px-2 py-0.5 rounded-full">
              第 {currentRound}/{maxRounds} 轮
            </span>
          )}
          <span className="text-xs text-text-muted tabular-nums font-mono">{formatElapsed(elapsedSeconds)}</span>
          <button onClick={handleEndClick} disabled={finishing} className="text-[10px] px-2.5 py-1 bg-red-500/10 text-red-400 rounded-md hover:bg-red-500/20 transition-colors disabled:opacity-30">
            结束面试
          </button>
        </div>
      </div>

      {/* Split View */}
      <div className="flex-1 flex gap-3 p-3 min-h-0">
        <div className="flex-1 bg-surface-1 backdrop-blur-md rounded-2xl flex flex-col border border-white/5 relative overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
              linear-gradient(rgba(139,92,246,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(139,92,246,0.06) 1px, transparent 1px),
              radial-gradient(ellipse at center, rgba(139,92,246,0.08) 0%, transparent 60%)
            `,
              backgroundSize: "30px 30px, 30px 30px, 100% 100%",
            }}
          />
          <div className="px-3 py-2 text-xs text-accent font-medium shrink-0 relative">AI 面试官</div>
          <div className="flex-1 flex items-center justify-center relative">
            <AIAvatar state={avatarState} />
          </div>
        </div>
        <div className="flex-1 bg-surface-1 backdrop-blur-md rounded-2xl flex flex-col border border-white/5 overflow-hidden">
          <div className="flex-1">
            <CameraPreview />
          </div>
        </div>
      </div>

      {/* Subtitle — visible while AI is speaking/loading or waiting for user, hidden when user starts recording */}
      <SubtitleBar
        text={subtitleLoading && !subtitle ? "正在组织问题" : subtitle}
        visible={ttsState === "loading" || ttsState === "playing" || appState === "waiting_for_user"}
        loading={subtitleLoading && !subtitle}
      />

      {/* Voice Controls */}
      {appState !== "finished" && <VoiceControls state={controlsState} onStart={handleStartRecording} onStop={handleStopRecording} disabled={finishing} />}

      {/* Finished state */}
      {appState === "finished" && (
        <div className="text-center py-4 shrink-0 border-t border-white/5">
          <p className="text-green-400 text-sm font-medium mb-2">面试已完成</p>
          <button onClick={() => router.push(`/results/${interviewId}`)} className="text-sm px-4 py-2 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600 transition-colors">
            查看评分报告
          </button>
        </div>
      )}
    </div>
  );
}
