"use client";

import { Bubble } from "@ant-design/x";
import { Avatar } from "antd";

interface MessageItem {
  id: number;
  role: string;
  content: string;
}

const roleConfig = {
  interviewer: {
    placement: "start" as const,
    avatar: <Avatar style={{ background: "#6366f1", color: "#fff", fontWeight: 700 }} size={36}>AI</Avatar>,
    styles: { content: { background: "#f1f5f9", color: "#334155", borderRadius: 16 } },
  },
  user: {
    placement: "end" as const,
    avatar: <Avatar style={{ background: "#e2e8f0", color: "#475569" }} size={36}>面试者</Avatar>,
    styles: { content: { background: "#22c55e", color: "#fff", borderRadius: 16 } },
  },
};

export default function ChatHistory({ messages }: { messages: MessageItem[] }) {
  if (!messages?.length) return null;

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <h2 className="font-display text-lg font-semibold text-text-primary mb-4">面试对话记录</h2>
      <div className="bg-surface-1 border border-border rounded-2xl p-4">
        <Bubble.List
          role={roleConfig}
          items={messages.map((m) => ({
            key: String(m.id),
            role: m.role as "interviewer" | "user",
            content: m.content,
          }))}
          style={{ maxHeight: "70vh", overflow: "auto" }}
        />
      </div>
    </div>
  );
}
