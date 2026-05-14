/**
 * One-time script: create a custom voice via DashScope Voice Design API.
 *
 * Usage:
 *   DASHSCOPE_API_KEY=xxx npx tsx scripts/create-voice.ts
 *
 * Outputs the voice_id to store as DASHSCOPE_TTS_VOICE_ID env var.
 */

const DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/api/v1";
const API_KEY = process.env.DASHSCOPE_API_KEY;

if (!API_KEY) {
  console.error("Error: DASHSCOPE_API_KEY environment variable is required");
  process.exit(1);
}

async function main() {
  console.log("Creating custom interviewer voice...");

  const res = await fetch(`${DASHSCOPE_BASE_URL}/services/audio/tts/customization`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "qwen-voice-design",
      input: {
        action: "create",
        voice_prompt: "温暖沉稳的中年男声，语速适中，专业且有亲和力，适合面试场景",
        preview_text: "同学你好，欢迎参加今天的面试，请先简单介绍一下自己。",
        target_model: "qwen3-tts-vd-2026-01-26",
        preferred_name: "interviewer_male",
      },
      parameters: {
        sample_rate: 24000,
        response_format: "wav",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Voice design failed (${res.status}):`, errText);
    process.exit(1);
  }

  const data = await res.json();
  const voiceId = data?.output?.voice_id;

  if (!voiceId) {
    console.error("No voice_id in response:", JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log("\n✅ Voice created successfully!");
  console.log(`   voice_id: ${voiceId}`);
  console.log("\nAdd this to your .env file:");
  console.log(`   DASHSCOPE_TTS_VOICE_ID=${voiceId}`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
