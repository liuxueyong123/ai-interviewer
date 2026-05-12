import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/database";
import { Interview } from "@/entities/Interview";
import { Message } from "@/entities/Message";
import { buildInterviewSystemPrompt } from "@/lib/deepseek";
import { getUserId } from "@/lib/utils";
import { validate, chatSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";
import { EventSourceParserStream } from "eventsource-parser/stream";

export const maxDuration = 60;

const API_KEY = process.env.DEEPSEEK_API_KEY || "";
const BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

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

  const chatMessages: Array<{ role: string; content: string }> = [
    { role: "system", content: buildInterviewSystemPrompt(interview.position, interview.resumeText, interview.questionCount, interview.difficulty) },
  ];

  for (const m of history) {
    chatMessages.push({
      role: m.role === "interviewer" ? "assistant" : "user",
      content: m.content,
    });
  }

  const displayMessage = hint
    ? `[提示请求] 用户需要一些思考方向。请针对当前问题给出简短提示或关键概念引导，但不要直接给出答案，也不要进入下一个问题。提示后等待用户正式回答。用户原文：${message}`
    : message;
  chatMessages.push({ role: "user", content: displayMessage });

  const deepseekRes = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-v4-pro",
      messages: chatMessages,
      temperature: 0.7,
      stream: true,
      thinking: { type: "disabled" },
    }),
  });

  if (!deepseekRes.ok) {
    const body = await deepseekRes.text();
    logger.error("DeepSeek API error", { status: deepseekRes.status, body });
    return new Response(body, { status: 502 });
  }

  if (!deepseekRes.body) {
    return new Response("No response body", { status: 500 });
  }

  const eventStream = deepseekRes.body.pipeThrough(new TextDecoderStream()).pipeThrough(new EventSourceParserStream());
  const reader = eventStream.getReader();
  const encoder = new TextEncoder();
  let fullContent = "";

  const stream = new ReadableStream({
    start(controller) {
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // value is EventSourceMessage { data: string }
            if (value.data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(value.data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullContent += content;
                const chunk = JSON.stringify({ type: "chunk", content });
                controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
              }
            } catch {
              // Skip unparseable data
            }
          }

          // Save user message after building the API request
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
      })();
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
