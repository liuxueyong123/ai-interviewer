import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Interview } from "@/entities/Interview";
import { Message } from "@/entities/Message";
import { verifyToken } from "@/lib/auth";
import { buildInterviewSystemPrompt, sendInterviewMessage } from "@/lib/deepseek";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  if (!token) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { interviewId, message } = await request.json();
  if (!interviewId || !message) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }

  const ds = await getDataSource();
  const interview = await ds.getRepository(Interview).findOne({
    where: { id: interviewId, user: { id: payload.userId } },
    relations: ["messages"],
  });

  if (!interview) return NextResponse.json({ error: "面试不存在" }, { status: 404 });
  if (interview.status === "done") return NextResponse.json({ error: "面试已结束" }, { status: 400 });

  const msgRepo = ds.getRepository(Message);

  // Save user message
  const userMsg = msgRepo.create({
    interview: { id: interviewId },
    role: "user",
    content: message,
    questionNumber: null,
  });
  await msgRepo.save(userMsg);

  // Count existing interviewer questions
  const questionCount = await msgRepo.count({
    where: { interview: { id: interviewId }, role: "interviewer" },
  });

  const isFirstMessage = questionCount === 0;

  // Build message history for AI
  const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];

  if (isFirstMessage) {
    chatMessages.push({
      role: "system",
      content: buildInterviewSystemPrompt(interview.position, interview.resumeText),
    });
  } else {
    // Load conversation history
    const history = await msgRepo.find({
      where: { interview: { id: interviewId } },
      order: { createdAt: "ASC" },
    });

    const historyText = history
      .map((m) => `${m.role === "interviewer" ? "面试官" : "候选人"}：${m.content}`)
      .join("\n\n");

    chatMessages.push({
      role: "system",
      content: `${buildInterviewSystemPrompt(interview.position, interview.resumeText)}\n\n以下是已经进行的对话：\n${historyText}\n\n请根据以上对话继续提出下一个问题。`,
    });
  }

  chatMessages.push({ role: "user", content: message });

  try {
    const reply = await sendInterviewMessage(chatMessages);

    const newCount = questionCount + 1;
    const interviewerMsg = msgRepo.create({
      interview: { id: interviewId },
      role: "interviewer",
      content: reply,
      questionNumber: newCount,
    });
    await msgRepo.save(interviewerMsg);

    // Auto-finish if question limit reached
    if (newCount >= 12) {
      interview.status = "done";
      await ds.getRepository(Interview).save(interview);
    }

    return NextResponse.json({
      reply,
      questionNumber: newCount,
      isFinished: interview.status === "done",
    });
  } catch (error) {
    console.error("Chat API error:", error);
    const message = error instanceof Error ? error.message : "AI响应失败，请重试";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
