import { NextRequest } from "next/server";
import { AIMessage, HumanMessage, type BaseMessage } from "@langchain/core/messages";
import { getDataSource } from "@/lib/database";
import { Interview } from "@/entities/Interview";
import { Message } from "@/entities/Message";
import { buildInterviewSystemMessage, getChatModel, distributeQuestions } from "@/lib/deepseek";
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
    relations: ["messages", "evaluations"],
  });

  if (!interview) return new Response("Interview not found", { status: 404 });
  if (interview.status === "done" || interview.status === "passed") return new Response("Interview ended", { status: 400 });

  const msgRepo = ds.getRepository(Message);

  const currentRound = interview.currentRound;

  const [questionCount, history] = await Promise.all([
    msgRepo.count({ where: { interview: { id: interviewId }, role: "interviewer", round: currentRound } }),
    msgRepo.find({ where: { interview: { id: interviewId }, round: currentRound }, order: { createdAt: "ASC" } }),
  ]);

  const roundQuestions = distributeQuestions(interview.questionCount, interview.maxRounds);
  const currentRoundQuestions = roundQuestions[currentRound - 1];

  let prevRoundContext: string | undefined;
  if (currentRound > 1) {
    const prevEvals = (interview.evaluations || [])
      .filter((e) => e.round < currentRound)
      .sort((a, b) => a.round - b.round);
    if (prevEvals.length > 0) {
      prevRoundContext = prevEvals
        .map((e) => {
          const summary = e.roundSummary || `${e.strengths}。${e.weaknesses}`;
          return `第 ${e.round} 轮（得分 ${e.overallScore}/100）总结：${summary}`;
        })
        .join("\n");
    }
  }

  const chatMessages: BaseMessage[] = [
    buildInterviewSystemMessage(
      interview.position,
      interview.resumeText,
      currentRoundQuestions,
      interview.difficulty,
      currentRound,
      interview.maxRounds,
      prevRoundContext
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
          round: currentRound,
          questionNumber: null,
        });
        await msgRepo.save(userMsg);

        const newCount = questionCount + 1;
        const interviewerMsg = msgRepo.create({
          interview: { id: interviewId },
          role: "interviewer",
          content: fullContent,
          round: currentRound,
          questionNumber: newCount,
        });
        await msgRepo.save(interviewerMsg);

        const doneEvent = JSON.stringify({
          type: "done",
          questionNumber: newCount,
          round: currentRound,
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
