import { logger } from "@/lib/logger";

const BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

export function buildInterviewSystemPrompt(position: string, resumeText: string, questionCount: number = 12, difficulty: string = "mid"): string {
  const difficultyHint =
    difficulty === "junior"
      ? "面试者处于初级水平，问题应偏重基础概念和常见场景，适当给予引导和鼓励。"
      : difficulty === "senior"
        ? "面试者处于高级水平，问题应偏重架构设计、系统优化、技术决策和深度原理，可适当追问和挑战。"
        : "面试者处于中级水平，问题应兼顾基础深度和实际项目经验，保持适度挑战。";

  return `你是 ${position} 的技术面试官。请严格遵守以下规则：

规则：
1. 每次只提一个问题，等待回答后再提下一个
2. 问题覆盖技术深度、项目经验、行为面试三个维度（比例约 50%/45%/5%）
3. 不评价回答，保持中立
4. 共提问约 ${questionCount} 个问题，如果提问结束，直接回复"我们的面试环节已结束，谢谢您的真诚分享和参与。"。

${difficultyHint}

候选人简历：${resumeText}

开始面试：先简短自我介绍，然后提第一个问题，让用户介绍自己。`;
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
  "resumeSuggestions": "<简历优化建议>",
  "practiceSuggestions": [
    {
      "area": "<薄弱领域，如：系统设计、算法、沟通表达>",
      "description": "<具体问题表现，50字以内>",
      "suggestion": "<可执行的练习方案，100字以内>"
    }
  ],
  "questionReviews": [
    {
      "questionNumber": 1,
      "question": "<面试官的提问原文摘要>",
      "score": <0-100>,
      "comment": "<针对该题回答的简短点评，50字以内>"
    }
  ]
}

注意：
- questionReviews 数组中每道面试官提问对应一条记录
- questionNumber 从 1 开始递增
- score 为该题回答质量的独立评分
- comment 要简短精炼，点出关键问题或亮点
- practiceSuggestions 针对候选人的薄弱环节给出 2-4 条结构化练习建议
- 面试官的最后结束语不算问题，不需要放进 questionReviews 中

面试记录：
${conversationHistory}

候选人简历：${resumeText}`;
}

export async function getEvaluation(promptText: string): Promise<string> {
  const API_KEY = process.env.DEEPSEEK_API_KEY || "";
  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ model: "deepseek-v4-pro", messages: [{ role: "user", content: promptText }], temperature: 0 }),
  });
  if (!res.ok) {
    const body = await res.text();
    logger.error("DeepSeek evaluation error", { status: res.status, body });
    throw new Error(`DeepSeek API error ${res.status}: ${body}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}
