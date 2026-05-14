import { Suspense } from "react";
import VoiceInterview from "@/components/interview/VoiceInterview";

export default function VoiceChatPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-[#0b1120] text-slate-400">
        加载中...
      </div>
    }>
      <VoiceInterview />
    </Suspense>
  );
}
