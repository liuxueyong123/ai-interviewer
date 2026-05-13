import { NextRequest } from "next/server";
import { AIMessage, HumanMessage, type BaseMessage } from "@langchain/core/messages";
import { getDataSource } from "@/lib/database";
import { Interview } from "@/entities/Interview";
import { Message } from "@/entities/Message";
import { buildInterviewSystemMessage, getChatModel } from "@/lib/deepseek";
import { getUserId } from "@/lib/utils";
import { validate, chatSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const userId = getUserId(request);
  const body = validate(chatSchema, await request.json());
  const { interviewId, message, hint } = body;

  const ds = await getDataSource();
  const interview = await ds.getRepository(Interview).findOne({
    where: { id: interviewId, user: { id: userId } },
    relations: ["messages"],
  });

  if (!interview) return new Response("Interview not found", { status: 404 });
  if (interview.status === "done") return new Response("Interview ended", { status: 400 });

  const msgRepo = ds.getRepository(Message);

  const [questionCount, history] = await Promise.all([
    msgRepo.count({ where: { interview: { id: interviewId }, role: "interviewer" } }),
    msgRepo.find({ where: { interview: { id: interviewId } }, order: { createdAt: "ASC" } }),
  ]);

  const chatMessages: BaseMessage[] = [
    buildInterviewSystemMessage(
      interview.position,
      interview.resumeText,
      interview.questionCount,
      interview.difficulty
    ),
  ];

  for (const m of history) {
    chatMessages.push(
      m.role === "interviewer" ? new AIMessage(m.content) : new HumanMessage(m.content)
    );
  }

  const displayMessage = hint
    ? `[提示请求] 用户需要一些思考方向。请针对当前问题给出简短提示或关键概念引导，但不要直接给出答案，也不要进入下一个问题。提示后等待用户正式回答。用户原文：${message}`
    : message;
  chatMessages.push(new HumanMessage(displayMessage));

  const model = getChatModel();

  const encoder = new TextEncoder();
  let fullContent = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const langchainStream = await model.stream(chatMessages);
        for await (const chunk of langchainStream) {
          const content = typeof chunk.content === "string" ? chunk.content : "";
          if (content) {
            fullContent += content;
            const sseChunk = JSON.stringify({ type: "chunk", content });
            controller.enqueue(encoder.encode(`data: ${sseChunk}\n\n`));
          }
        }

        const userMsg = msgRepo.create({
          interview: { id: interviewId },
          role: "user",
          content: message,
          questionNumber: null,
        });
        await msgRepo.save(userMsg);

        const newCount = questionCount + 1;
        const interviewerMsg = msgRepo.create({
          interview: { id: interviewId },
          role: "interviewer",
          content: fullContent,
          questionNumber: newCount,
        });
        await msgRepo.save(interviewerMsg);

        const doneEvent = JSON.stringify({
          type: "done",
          questionNumber: newCount,
        });
        controller.enqueue(encoder.encode(`data: ${doneEvent}\n\n`));
        controller.close();
      } catch (err) {
        logger.error("Stream error", { error: String(err) });
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
