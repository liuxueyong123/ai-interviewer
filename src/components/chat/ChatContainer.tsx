"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ChatMessage from "./ChatMessage";

interface Message {
  id: number;
  role: "interviewer" | "user";
  content: string;
  questionNumber: number | null;
}

export default function ChatContainer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const interviewId = searchParams.get("id");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || loading || !interviewId) return;

    const userMsg = input.trim();
    setInput("");
    setError("");

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: "user", content: userMsg, questionNumber: null },
    ]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId: parseInt(interviewId, 10), message: userMsg }),
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error || "发送失败");
        return;
      }

      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "interviewer", content: data.reply, questionNumber: data.questionNumber },
      ]);

      if (data.isFinished) {
        setFinished(true);
      }
    } catch {
      setLoading(false);
      setError("网络错误，请重试");
    }
  }

  async function finishInterview() {
    if (!interviewId || finished) return;
    setLoading(true);

    const res = await fetch(`/api/interviews/${interviewId}/finish`, { method: "POST" });
    setLoading(false);

    if (res.ok) {
      router.push(`/results/${interviewId}`);
    } else {
      setError("结束面试失败，请重试");
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <h1 className="font-semibold text-sm">AI 面试进行中</h1>
        <span className="text-xs text-gray-400">
          问题 {messages.filter((m) => m.role === "interviewer").length} / 12
        </span>
        <button
          onClick={finishInterview}
          disabled={loading || finished}
          className="text-xs px-3 py-1 bg-red-50 text-red-600 rounded-full hover:bg-red-100 disabled:opacity-50 transition-colors"
        >
          结束面试
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && !loading && (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-lg mb-2">面试即将开始</p>
            <p className="text-sm">AI 面试官正在准备第一个问题...</p>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
        ))}
        {loading && (
          <div className="flex justify-start mb-4">
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
              <span className="text-xs text-indigo-500">面试官</span>
              <div className="flex gap-1 mt-2">
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
        {finished && (
          <div className="text-center mt-4">
            <p className="text-green-600 text-sm mb-2">面试已完成</p>
            <button
              onClick={() => router.push(`/results/${interviewId}`)}
              className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              查看评分报告
            </button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {!finished && (
        <div className="border-t border-gray-200 bg-white px-4 py-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
              placeholder="输入你的回答..."
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              发送
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
