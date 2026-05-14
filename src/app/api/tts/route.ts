import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getUserId } from "@/lib/utils";
import { validate, ttsSchema } from "@/lib/validations";

const DASHSCOPE_BASE_URL = process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/api/v1";
const TTS_VOICE_ID = process.env.DASHSCOPE_TTS_VOICE_ID;

export async function POST(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  if (!TTS_VOICE_ID) {
    logger.error("TTS voice_id not configured");
    return NextResponse.json({ error: "TTS 未配置" }, { status: 500 });
  }

  let body: { text: string };
  try {
    body = validate(ttsSchema, await request.json());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  logger.info("TTS request", { userId, textLen: body.text.length });

  try {
    const res = await fetch(`${DASHSCOPE_BASE_URL}/services/aigc/multimodal-generation/generation`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.DASHSCOPE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen3-tts-vd-2026-01-26",
        input: {
          text: body.text,
          voice: TTS_VOICE_ID,
          language_type: "Chinese",
        },
        parameters: {
          speech_rate: 1.2,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      logger.error("DashScope TTS error", { status: res.status, error: errText });
      return NextResponse.json({ error: "语音合成失败" }, { status: 502 });
    }

    const data = await res.json();
    const audioUrl = data?.output?.audio?.url;

    if (!audioUrl) {
      logger.error("TTS response missing audio URL");
      return NextResponse.json({ error: "语音合成失败" }, { status: 502 });
    }

    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      logger.error("TTS audio download failed", { status: audioRes.status });
      return NextResponse.json({ error: "语音合成失败" }, { status: 502 });
    }

    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    const base64 = audioBuffer.toString("base64");
    const dataUri = `data:audio/wav;base64,${base64}`;

    return NextResponse.json({ audio: dataUri });
  } catch (err) {
    logger.error("TTS unexpected error", { error: String(err) });
    return NextResponse.json({ error: "语音合成失败" }, { status: 502 });
  }
}
