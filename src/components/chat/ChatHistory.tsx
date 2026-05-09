"use client";

import { Bubble } from "@ant-design/x";
import { roleConfig } from "./roleConfig";

interface MessageItem {
  id: number;
  role: string;
  content: string;
}

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
