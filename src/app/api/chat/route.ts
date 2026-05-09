import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/database";
import { Interview } from "@/entities/Interview";
import { Message } from "@/entities/Message";
import { buildInterviewSystemPrompt } from "@/lib/deepseek";
import { getUserId } from "@/lib/utils";
import { EventSourceParserStream } from "eventsource-parser/stream";

const API_KEY = process.env.DEEPSEEK_API_KEY || "";
const BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

export async function POST(request: NextRequest) {
  const userId = getUserId(request);
  const { interviewId, message } = await request.json();
  if (!interviewId || !message) {
    return new Response("Missing params", { status: 400 });
  }

  const ds = await getDataSource();
  const interview = await ds.getRepository(Interview).findOne({
    where: { id: interviewId, user: { id: userId } },
    relations: ["messages"],
  });

  if (!interview) return new Response("Interview not found", { status: 404 });
  if (interview.status === "done") return new Response("Interview ended", { status: 400 });

  const msgRepo = ds.getRepository(Message);

  // Save user message
  const userMsg = msgRepo.create({
    interview: { id: interviewId },
    role: "user",
    content: message,
    questionNumber: null,
  });
  await msgRepo.save(userMsg);

  const questionCount = await msgRepo.count({
    where: { interview: { id: interviewId }, role: "interviewer" },
  });

  // Build messages: system prompt + conversation history + current user message
  const chatMessages: Array<{ role: string; content: string }> = [{ role: "system", content: buildInterviewSystemPrompt(interview.position, interview.resumeText) }];

  // Load and append any previous messages as proper role-based messages
  const history = await msgRepo.find({
    where: { interview: { id: interviewId } },
    order: { createdAt: "ASC" },
  });

  for (const m of history) {
    chatMessages.push({
      role: m.role === "interviewer" ? "assistant" : "user",
      content: m.content,
    });
  }

  // Append the current user message (not yet saved to DB)
  chatMessages.push({ role: "user", content: message });

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
    }),
  });

  if (!deepseekRes.ok) {
    const body = await deepseekRes.text();
    console.error("DeepSeek API error:", deepseekRes.status, body);
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
          console.error("Stream error:", err);
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
