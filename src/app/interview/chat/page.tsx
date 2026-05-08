import { Suspense } from "react";
import ChatContainer from "@/components/chat/ChatContainer";

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-400">加载中...</div>}>
      <ChatContainer />
    </Suspense>
  );
}
