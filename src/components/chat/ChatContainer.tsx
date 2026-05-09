"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Bubble, Sender } from "@ant-design/x";
import { message } from "antd";
import { EventSourceParserStream } from "eventsource-parser/stream";
import { roleConfig } from "./roleConfig";

interface BubbleItem {
  key: string;
  role: "interviewer" | "user";
  content: string;
  loading?: boolean;
  streaming?: boolean;
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

  const sendMessage = useCallback(
    async function sendMessageFn(userMsg: string) {
      if (!interviewId || loading) return;
      setError("");
      setLoading(true);
      setSenderValue("");
      const userKey = Date.now().toString();
      const aiKey = (Date.now() + 1).toString();
      setMessages((prev) => [...prev, { key: userKey, role: "user", content: userMsg }, { key: aiKey, role: "interviewer", content: "", loading: true }]);
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
              setMessages((prev) => prev.map((m) => (m.key === aiKey ? { ...m, content: m.content + event.content, loading: false, streaming: true } : m)));
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
      })
      .catch(() => {});
  }, [interviewId]);

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

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h1 className="font-semibold text-sm text-gray-800">AI 面试进行中</h1>
        <span className="text-xs text-text-muted tabular-nums">问题 {questionCount}</span>
        <button
          onClick={finishInterview}
          disabled={loading || finished || finishing}
          className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-40 transition-all duration-200 font-medium cursor-pointer"
        >
          {finishing ? "评估中..." : "结束面试"}
        </button>
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
