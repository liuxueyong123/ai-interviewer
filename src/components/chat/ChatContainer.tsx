"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Bubble, Sender } from "@ant-design/x";
import { message } from "antd";
import { EventSourceParserStream } from "eventsource-parser/stream";
import { roleConfig } from "./roleConfig";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

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
  const [senderValue, setSenderValue] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // Timer
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Voice
  const { isListening, isSupported: micSupported, startListening, stopListening, transcriptRef } = useSpeechRecognition();

  const sendMessage = useCallback(
    async function sendMessageFn(userMsg: string, isHint = false) {
      if (!interviewId || loading) return;
      setError("");
      setLoading(true);
      setSenderValue("");
      const displayMsg = isHint ? "（请求提示）" : userMsg;
      const userKey = Date.now().toString();
      const aiKey = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        { key: userKey, role: "user", content: displayMsg },
        { key: aiKey, role: "interviewer", content: "AI 正在思考...", loading: true },
      ]);
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
                prev.map((m) =>
                  m.key === aiKey
                    ? { ...m, content: m.content === "AI 正在思考..." ? event.content : m.content + event.content, loading: false, streaming: true }
                    : m,
                ),
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
        if (data.messages?.length) {
          setMessages(
            data.messages.map((m: { id: number; role: string; content: string }) => ({
              key: String(m.id),
              role: m.role as "interviewer" | "user",
              content: m.content,
            })),
          );
          setQuestionCount(data.messages.filter((m: { role: string }) => m.role === "interviewer").length);
        }
        if (data.interview?.status === "done") setFinished(true);
        if (data.interview?.createdAt) setStartTime(new Date(data.interview.createdAt));
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

  // Voice transcript → input
  useEffect(() => {
    const ref = transcriptRef;
    const check = setInterval(() => {
      if (ref.current && !isListening) {
        setSenderValue((prev) => prev + ref.current);
        ref.current = "";
      }
    }, 200);
    return () => clearInterval(check);
  }, [isListening, transcriptRef]);

  const cancelRequest = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  async function finishInterview() {
    if (!interviewId || finished || finishing) return;
    setFinishing(true);
    const hide = message.loading("正在评估中，请稍候...", 0);
    const res = await fetch(`/api/interviews/${interviewId}/finish`, { method: "POST" });
    hide();
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
      onClick={isListening ? stopListening : startListening}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 ${
        isListening ? "bg-danger text-white animate-pulse" : "text-text-muted hover:text-accent hover:bg-accent-muted"
      }`}
      title={isListening ? "停止录音" : "语音输入"}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    </button>
  ) : null;

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-sm text-gray-800">AI 面试进行中</h1>
          <span className="text-xs text-text-muted tabular-nums font-mono">{formatElapsed(elapsedSeconds)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted tabular-nums">问题 {questionCount}</span>
          <button
            onClick={sendHint}
            disabled={loading || finished}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 text-text-secondary hover:text-accent hover:bg-accent-muted rounded-lg disabled:opacity-30 transition-all duration-200 font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
            </svg>
            给点提示
          </button>
          <button
            onClick={handleFinishClick}
            disabled={loading || finished || finishing}
            className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-40 transition-all duration-200 font-medium cursor-pointer"
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
