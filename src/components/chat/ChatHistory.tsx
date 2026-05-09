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
    <div className="bg-surface-1 border border-border rounded-2xl shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-accent via-accent to-emerald-400" />
      <div className="p-4">
        <Bubble.List
          role={roleConfig}
          items={messages.map((m) => ({
            key: String(m.id),
            role: m.role as "interviewer" | "user",
            content: m.content,
          }))}
          style={{ maxHeight: "60vh", overflow: "auto" }}
        />
      </div>
    </div>
  );
}
