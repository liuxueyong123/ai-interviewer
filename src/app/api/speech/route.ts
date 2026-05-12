import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || "";
const DASHSCOPE_BASE_URL = process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const audioFile = formData.get("audio") as File | null;

  if (!audioFile) {
    return NextResponse.json({ error: "缺少音频文件" }, { status: 400 });
  }

  const arrayBuffer = await audioFile.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = audioFile.type || "audio/webm";
  const dataUri = `data:${mimeType};base64,${base64}`;

  logger.info("ASR request", { size: arrayBuffer.byteLength, mimeType });

  const res = await fetch(`${DASHSCOPE_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "qwen3-asr-flash",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "input_audio",
              input_audio: { data: dataUri },
            },
          ],
        },
      ],
      extra_body: {
        asr_options: {
          language: "zh",
          enable_itn: false,
        },
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    logger.error("DashScope ASR error", { status: res.status, body: errText });
    return NextResponse.json({ error: "语音识别失败" }, { status: 502 });
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";

  return NextResponse.json({ text });
}
