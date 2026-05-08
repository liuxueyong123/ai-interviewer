interface ChatMessageProps {
  role: "interviewer" | "user";
  content: string;
}

export default function ChatMessage({ role, content }: ChatMessageProps) {
  const isInterviewer = role === "interviewer";

  return (
    <div className={`flex ${isInterviewer ? "justify-start" : "justify-end"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${isInterviewer ? "bg-white border border-gray-200 text-gray-800" : "bg-indigo-600 text-white"}`}
      >
        {isInterviewer && <span className="text-xs font-medium text-indigo-500 block mb-1">面试官</span>}
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}
