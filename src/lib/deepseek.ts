const API_KEY = process.env.DEEPSEEK_API_KEY || "";
const BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function chat(messages: ChatMessage[]): Promise<string> {
  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-v4-pro",
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("DeepSeek API error:", res.status, body);
    throw new Error(`DeepSeek API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

export function buildInterviewSystemPrompt(
  position: string,
  resumeText: string,
  questionCount: number = 12
): string {
  return `你是 ${position} 的技术面试官。请严格遵守以下规则：

规则：
1. 每次只提一个问题，等待回答后再提下一个
2. 问题覆盖技术深度、项目经验、行为面试三个维度（比例约 45%/45%/10%）
3. 根据回答质量动态调整难度
4. 不评价回答，保持中立
5. 共提问约 ${questionCount} 个问题

候选人简历：${resumeText}

开始面试：先简短自我介绍，然后提第一个问题。`;
}

export function buildEvaluationPrompt(conversationHistory: string, resumeText: string): string {
  return `请根据以下面试对话，对候选人进行评分。输出纯 JSON 格式（不要 markdown 代码块）：

{
  "overallScore": <0-100>,
  "categories": {
    "tech": <0-100>,
    "project": <0-100>,
    "softSkills": <0-100>
  },
  "strengths": "<优点>",
  "weaknesses": "<待改进>",
  "resumeSuggestions": "<简历优化建议>"
}

面试记录：
${conversationHistory}

候选人简历：${resumeText}`;
}

export async function sendInterviewMessage(messages: ChatMessage[]): Promise<string> {
  return chat(messages);
}

export async function getEvaluation(messages: ChatMessage[]): Promise<string> {
  return chat(messages);
}
