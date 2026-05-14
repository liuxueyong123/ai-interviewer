"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Bubble, Sender } from "@ant-design/x";
import { XMarkdown } from "@ant-design/x-markdown";
import "@ant-design/x-markdown/dist/x-markdown.css";
import { toast } from "@/components/ui/Toast";
import { EventSourceParserStream } from "eventsource-parser/stream";
import { roleConfig } from "./roleConfig";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useTTS } from "@/hooks/useTTS";

interface BubbleItem {
  key: string;
  role: "interviewer" | "user";
  content: string;
  loading?: boolean;
  streaming?: boolean;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function ChatContainer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const interviewId = searchParams.get("id");

  const [messages, setMessages] = useState<BubbleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");
  const [questionCount, setQuestionCount] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(1);
  const [senderValue, setSenderValue] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // Timer
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Voice
  const handleVoiceResult = useCallback((text: string) => {
    setSenderValue((prev) => prev + text);
  }, []);
  const handleVoiceError = useCallback((err: string) => {
    toast.warning(err);
  }, []);
  const { recState, isSupported: micSupported, startListening, stopListening } = useSpeechRecognition(handleVoiceResult, handleVoiceError);
  const { speak: speakTTS, state: ttsState } = useTTS();
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);

  useEffect(() => {
    if (ttsState === "idle" || ttsState === "error") setSpeakingKey(null);
  }, [ttsState]);

  const sendMessage = useCallback(
    async function sendMessageFn(userMsg: string, isHint = false) {
      if (!interviewId || loading) return;
      setError("");
      setLoading(true);
      setSenderValue("");
      const displayMsg = isHint ? "（请求提示）" : userMsg;
      const userKey = Date.now().toString();
      const aiKey = (Date.now() + 1).toString();
      setMessages((prev) => [...prev, { key: userKey, role: "user", content: displayMsg }, { key: aiKey, role: "interviewer", content: "AI 正在思考...", loading: true }]);
      const abort = new AbortController();
      abortRef.current = abort;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interviewId: parseInt(interviewId, 10), message: userMsg, hint: isHint }),
          signal: abort.signal,
        });
        if (!res.ok) throw new Error(`请求失败 (${res.status})`);
        const eventStream = res.body!.pipeThrough(new TextDecoderStream()).pipeThrough(new EventSourceParserStream());
        const reader = eventStream.getReader();
        let fullContent = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          try {
            const event = JSON.parse(value.data);
            if (event.type === "chunk") {
              fullContent += event.content;
              setMessages((prev) =>
                prev.map((m) => (m.key === aiKey ? { ...m, content: m.content === "AI 正在思考..." ? event.content : m.content + event.content, loading: false, streaming: true } : m)),
              );
            } else if (event.type === "done") {
              setQuestionCount(event.questionNumber);
              setMessages((prev) => prev.map((m) => (m.key === aiKey ? { ...m, loading: false, streaming: false } : m)));
              if (fullContent.includes("面试环节已结束")) {
                finishInterview();
              }
            }
          } catch {
            /* skip */
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message || "网络错误");
          setMessages((prev) => prev.filter((m) => m.key !== aiKey));
        }
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [interviewId, loading],
  );

  // Load interview history
  useEffect(() => {
    if (!interviewId) return;
    fetch(`/api/interviews/${interviewId}`)
      .then((res) => res.json())
      .then((data) => {
        const round = data.interview?.currentRound ?? 1;
        setCurrentRound(round);
        setMaxRounds(data.interview?.maxRounds ?? 1);

        const roundMessages = (data.messages || []).filter(
          (m: { round: number }) => m.round === round
        );
        if (roundMessages.length) {
          setMessages(
            roundMessages.map((m: { id: number; role: string; content: string }) => ({
              key: String(m.id),
              role: m.role as "interviewer" | "user",
              content: m.content,
            })),
          );
          setQuestionCount(roundMessages.filter((m: { role: string }) => m.role === "interviewer").length);
        }
        if (data.interview?.status === "done" || data.interview?.status === "evaluating") setFinished(true);
	        const storageKey = `interview_timer_${interviewId}_round_${round}`;
	        let roundStart = localStorage.getItem(storageKey);
	        if (!roundStart) {
	          roundStart = String(Date.now());
	          localStorage.setItem(storageKey, roundStart);
	        }
	        setStartTime(new Date(parseInt(roundStart, 10)));
      })
      .catch(() => {});
  }, [interviewId]);

  // Timer tick
  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startTime.getTime()) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  // Leave confirmation
  useEffect(() => {
    if (finished) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [finished]);

  const cancelRequest = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  async function finishInterview() {
    if (!interviewId || finished || finishing) return;
    setFinishing(true);
    const res = await fetch(`/api/interviews/${interviewId}/finish`, { method: "POST" });
    if (res.ok) {
      router.push(`/results/${interviewId}`);
    } else {
      setError("结束面试失败");
      setFinishing(false);
    }
  }

  function handleFinishClick() {
    if (!window.confirm("确定要结束当前面试吗？结束后将无法继续回答。")) return;
    finishInterview();
  }

  async function sendHint() {
    await sendMessage("请给我一点提示，帮助我思考当前问题", true);
  }

  const micButton = micSupported ? (
    <button
      type="button"
      onClick={recState === "recording" ? stopListening : startListening}
      disabled={recState === "processing" || loading}
      className={`inline-flex items-center h-9 px-2.5 gap-1 -ml-1.5 -mr-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
        recState === "recording"
          ? "bg-danger text-white shadow-[0_0_0_3px_rgba(239,68,68,0.2)]"
          : recState === "processing"
            ? "bg-surface-2 text-text-muted"
            : "text-text-muted hover:text-accent hover:bg-accent-muted"
      } disabled:opacity-50`}
      title={recState === "recording" ? "点击停止录音" : "语音输入"}
    >
      {recState === "processing" ? (
        <>
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
            />
          </svg>
          识别中...
        </>
      ) : recState === "recording" ? (
        <>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
          </span>
          聆听中
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
            />
          </svg>
        </>
      )}
    </button>
  ) : null;

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-surface-1">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-sm text-text-primary">AI 面试进行中</h1>
          {maxRounds > 1 && (
            <span className="text-xs text-accent font-medium bg-accent-muted px-2 py-0.5 rounded-full">第 {currentRound}/{maxRounds} 轮</span>
          )}
          <span className="text-xs text-text-muted tabular-nums font-mono">{formatElapsed(elapsedSeconds)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted tabular-nums">问题 {questionCount}</span>
          <button
            onClick={sendHint}
            disabled={loading || finished || finishing}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 text-text-secondary hover:text-accent hover:bg-accent-muted rounded-lg disabled:opacity-30 transition-all duration-200 font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
              />
            </svg>
            给点提示
          </button>
          <button
            onClick={handleFinishClick}
            disabled={loading || finished || finishing}
            className="text-xs px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 disabled:opacity-40 transition-all duration-200 font-medium cursor-pointer"
          >
            {finishing ? "评估中..." : "结束面试"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Bubble.List
          autoScroll
          role={roleConfig}
          items={messages.map((m) => ({
            key: m.key,
            role: m.role,
            content: m.content,
            loading: m.loading,
            streaming: m.streaming,
            ...(m.role === "interviewer" && !m.loading
              ? {
                  contentRender: (content: string) => (
                    <div>
                      <XMarkdown content={content} streaming={{ hasNextChunk: m.streaming ?? false, enableAnimation: true }} />
                      {!m.streaming && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSpeakingKey(m.key); speakTTS(content); }}
                          disabled={ttsState === "loading" && speakingKey === m.key}
                          className="inline-flex items-center gap-1 mt-2 text-xs text-text-muted hover:text-accent transition-colors"
                          title="播放语音"
                        >
                          {ttsState === "loading" && speakingKey === m.key ? (
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
          }))}
          style={{ height: "100%", padding: "16px" }}
        />
      </div>

      {error && <p className="text-red-500 text-xs text-center py-1 shrink-0">{error}</p>}

      {finished ? (
        <div className="text-center py-4 shrink-0 border-t border-border">
          <p className="text-accent text-sm font-medium mb-2">面试已完成</p>
          <button
            onClick={() => router.push(`/results/${interviewId}`)}
            className="text-sm px-4 py-2 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover active:scale-[0.98] transition-all duration-200 font-display cursor-pointer"
          >
            查看评分报告
          </button>
        </div>
      ) : (
        <div className="shrink-0 border-t border-border px-4 py-3">
          <Sender
            value={senderValue}
            onChange={setSenderValue}
            loading={loading}
            placeholder="输入你的回答..."
            prefix={micButton}
            onSubmit={(val) => {
              sendMessage(val);
            }}
            onCancel={cancelRequest}
          />
        </div>
      )}
    </div>
  );
}
