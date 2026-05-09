"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Bubble, Sender } from "@ant-design/x";
import { Avatar } from "antd";

const AIAvatar = () => (
  <Avatar style={{ background: "#4f46e5" }} size={36}>
    AI
  </Avatar>
);

const UserAvatar = () => (
  <Avatar style={{ background: "#10b981" }} size={36}>
    我
  </Avatar>
);

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
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");
  const [questionCount, setQuestionCount] = useState(0);
  const [senderValue, setSenderValue] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const greetingSentRef = useRef(false);

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

        if (!res.ok) {
          throw new Error(`请求失败 (${res.status})`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("无法读取响应");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (!json) continue;

            try {
              const event = JSON.parse(json);

              if (event.type === "chunk") {
                setMessages((prev) => prev.map((m) => (m.key === aiKey ? { ...m, content: m.content + event.content, loading: false, streaming: true } : m)));
              } else if (event.type === "done") {
                setQuestionCount(event.questionNumber);
                if (event.isFinished) setFinished(true);
                setMessages((prev) => prev.map((m) => (m.key === aiKey ? { ...m, loading: false, streaming: false } : m)));
              }
            } catch {
              // skip unparseable lines
            }
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

  // Load existing messages on mount, auto-send greeting for fresh interviews
  useEffect(() => {
    if (!interviewId) return;

    fetch(`/api/interviews/${interviewId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.messages?.length) {
          setMessages(
            data.messages.map((m: { id: number; role: string; content: string; questionNumber: number | null }) => ({
              key: String(m.id),
              role: m.role as "interviewer" | "user",
              content: m.content,
            })),
          );
          const count = data.messages.filter((m: { role: string }) => m.role === "interviewer").length;
          setQuestionCount(count);
        } else if (!greetingSentRef.current) {
          greetingSentRef.current = true;
          // Defer so sendMessage is initialized by call time
          setTimeout(() => sendMessage("面试官你好"), 100);
        }
        if (data.interview?.status === "done") setFinished(true);
      })
      .catch(() => {});
  }, [interviewId]);

  const cancelRequest = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  async function finishInterview() {
    if (!interviewId || finished) return;
    setLoading(true);
    const res = await fetch(`/api/interviews/${interviewId}/finish`, { method: "POST" });
    setLoading(false);
    if (res.ok) {
      router.push(`/results/${interviewId}`);
    } else {
      setError("结束面试失败");
    }
  }

  const roleConfig = {
    interviewer: {
      placement: "start" as const,
      avatar: <AIAvatar />,
    },
    user: {
      placement: "end" as const,
      avatar: <UserAvatar />,
      styles: { content: { background: "#4f46e5", color: "#fff" } },
    },
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <h1 className="font-semibold text-sm text-gray-800">AI 面试进行中</h1>
        <span className="text-xs text-gray-400">问题 {questionCount} / 12</span>
        <button onClick={finishInterview} disabled={loading || finished} className="text-xs px-3 py-1 bg-red-50 text-red-600 rounded-full hover:bg-red-100 disabled:opacity-50 transition-colors">
          结束面试
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
        <div className="text-center py-4 shrink-0 border-t border-gray-100">
          <p className="text-green-600 text-sm mb-2">面试已完成</p>
          <button onClick={() => router.push(`/results/${interviewId}`)} className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            查看评分报告
          </button>
        </div>
      ) : (
        <div className="shrink-0 border-t border-gray-100 px-4 py-3">
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
