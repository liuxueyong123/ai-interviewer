import { ChatDeepSeek } from "@langchain/deepseek";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { logger } from "@/lib/logger";

let _evaluationModel: ChatDeepSeek | null = null;
let _chatModel: ChatDeepSeek | null = null;
let _summaryModel: ChatDeepSeek | null = null;

function getBaseConfig() {
  return {
    apiKey: process.env.DEEPSEEK_API_KEY,
    configuration: {
      baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    },
  };
}

export function getEvaluationModel(): ChatDeepSeek {
  if (!_evaluationModel) {
    _evaluationModel = new ChatDeepSeek({
      ...getBaseConfig(),
      model: "deepseek-v4-pro",
      temperature: 0,
    });
  }
  return _evaluationModel;
}

export function getChatModel(): ChatDeepSeek {
  if (!_chatModel) {
    _chatModel = new ChatDeepSeek({
      ...getBaseConfig(),
      model: "deepseek-v4-pro",
      temperature: 0.7,
      modelKwargs: {
        thinking: { type: "disabled" },
      },
    });
  }
  return _chatModel;
}

function getSummaryModel(): ChatDeepSeek {
  if (!_summaryModel) {
    _summaryModel = new ChatDeepSeek({
      ...getBaseConfig(),
      model: "deepseek-v4-pro",
      temperature: 0.3,
    });
  }
  return _summaryModel;
}

const ROUND_FOCUS: Record<number, Record<number, string>> = {
  1: {
    1: "综合考察：覆盖技术基础、项目经验和综合素质",
    2: "第一轮侧重行业基础知识和简单项目经历",
    3: "第一轮侧重行业基础知识和简单项目经历",
  },
  2: {
    2: "第二轮侧重深度项目经历、大局观和职业规划",
    3: "第二轮侧重深度项目经历，追问技术细节和架构决策",
  },
  3: {
    3: "第三轮侧重项目经历、大局观和职业规划",
  },
};

export function distributeQuestions(total: number, rounds: number): number[] {
  if (rounds === 1) return [total];
  if (rounds === 2) {
    if (total === 8) return [5, 3];
    if (total === 12) return [7, 5];
    if (total === 20) return [11, 9];
    if (total === 28) return [16, 12];
  }
  if (rounds === 3) {
    if (total === 8) return [3, 3, 2];
    if (total === 12) return [5, 4, 3];
    if (total === 20) return [8, 7, 5];
    if (total === 28) return [12, 9, 7];
  }
  return [total];
}

const PASS_THRESHOLD: Record<string, Record<number, number>> = {
  junior: { 1: 50, 2: 55, 3: 60 },
  mid: { 1: 60, 2: 65, 3: 70 },
  senior: { 1: 65, 2: 70, 3: 75 },
};

export function getPassThreshold(difficulty: string, round: number): number {
  return PASS_THRESHOLD[difficulty]?.[round] ?? 60;
}

export function buildInterviewSystemMessage(
  position: string,
  resumeText: string,
  questionCount: number = 12,
  difficulty: string = "mid",
  round: number = 1,
  maxRounds: number = 1,
  prevRoundContext?: string,
  mode?: "text" | "voice",
): SystemMessage {
  const difficultyHint =
    difficulty === "junior"
      ? "面试者处于初级水平，问题应偏重基础概念和常见场景，适当给予引导和鼓励。"
      : difficulty === "senior"
        ? "面试者处于高级水平，问题应偏重架构设计、系统优化、技术决策和深度原理，可适当追问和挑战。"
        : "面试者处于中级水平，问题应兼顾基础深度和实际项目经验，保持适度挑战。";

  const focus = ROUND_FOCUS[round]?.[maxRounds] ?? ROUND_FOCUS[1]?.[1];
  const roundLabel = maxRounds > 1 ? `这是第 ${round}/${maxRounds} 轮面试。` : "";
  const endPhrase =
    round < maxRounds
      ? `如果本轮面试结束，直接回复"本轮面试环节已结束，稍后将通知面试结果。"，不要回复其他内容。`
      : '如果面试结束，直接回复"我们的面试环节已结束，谢谢您的真诚分享和参与。"，不要回复其他内容。';
  const startInstruction = round === 1 ? "先简短自我介绍，然后提第一个问题，让用户介绍自己。" : `这是第 ${round} 轮面试。请基于前一轮的评估反馈，继续深入提问。先简短开场，然后提第一个问题。`;
  const voiceRule = mode === "voice" ? "\n6. 这是语音面试，候选人通过语音听到你的提问。请只返回纯文本内容，不要使用任何 Markdown 格式（加粗、列表、标题、代码块、链接等），也不要使用特殊符号" : "";

  const prevBlock = prevRoundContext
    ? `\n---
## 前一轮评估总结

${prevRoundContext}
`
    : "";

  return new SystemMessage(
    `你是 ${position} 的技术面试官。${roundLabel}${focus}。

---
## 规则

1. 每次只提一个问题，等待回答后再提下一个
2. 本轮侧重：${focus}
3. 不评价候选人的回答，保持中立客观
4. 本轮约 ${questionCount} 个问题，${endPhrase}
5. ${difficultyHint}${voiceRule}
${prevBlock}
---
## 候选人简历

${resumeText}

---
## 开场

${startInstruction}`,
  );
}

export function buildRoundSummaryMessage(conversationHistory: string): HumanMessage {
  return new HumanMessage(
    `请根据以下面试对话，生成关于本轮面试的 100-200 字的简要总结。

## 总结要求

1. 本轮涉及的主要提问方向
2. 候选人回答的整体表现（亮点与不足）

---

## 对话记录

${conversationHistory}

---

请直接输出总结文本，不要 markdown 格式。`,
  );
}

export async function getRoundSummary(message: HumanMessage): Promise<string> {
  const model = getSummaryModel();
  const response = await model.invoke([message]);
  return (response.content as string) || "";
}

export function buildSingleQuestionEvaluationMessage(questionText: string, answerText: string, position: string): HumanMessage {
  return new HumanMessage(
    `请对以下一道面试题的候选人回答进行独立评分。目标岗位：${position}。输出纯 JSON 格式（不要 markdown 代码块）：

{
  "score": <0-100>,
  "comment": "<简短点评，50字以内>"
}

## 评分维度

技术准确性、表达清晰度、理解深度

---

## 面试官提问

${questionText}

## 候选人回答

${answerText}`,
  );
}

export function buildAggregationMessage(questionReviews: Array<{ questionNumber: number; question: string; answer: string; score: number; comment: string }>, resumeText: string): HumanMessage {
  const hasScore = (r: (typeof questionReviews)[number]) => r.comment && r.comment !== "评分失败";

  const annotatedConversation = questionReviews
    .map((r) => {
      const scoreLine = hasScore(r) ? `\n**评分**：${r.score}分 | ${r.comment}\n` : "\n";
      return `### Q${r.questionNumber}\n**面试官**：${r.question}\n**候选人**：${r.answer}${scoreLine}`;
    })
    .join("\n\n---\n\n");

  return new HumanMessage(
    `请根据以下面试对话记录（含逐题评分），对候选人进行综合评估。输出纯 JSON 格式（不要 markdown 代码块）：

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
      "area": "<薄弱领域>",
      "description": "<具体问题表现，50字以内>",
      "suggestion": "<可执行的练习方案，100字以内>"
    }
  ]
}

## 注意事项

- overallScore 综合逐题得分和整体表现判断，不要简单取平均值
- categories 三个维度各评分，参照逐题得分的分布
- strengths/weaknesses 基于对话中的实际表现，避免空洞评价
- practiceSuggestions 针对薄弱环节给出 2-4 条结构化练习建议

---

## 面试对话记录（含逐题评分）

${annotatedConversation}

---

## 候选人简历

${resumeText}`,
  );
}

export async function getEvaluation(message: HumanMessage): Promise<string> {
  const model = getEvaluationModel();
  const response = await model.invoke([message]);
  const content = response.content;
  if (typeof content !== "string") {
    logger.error("Unexpected evaluation response type", { contentType: typeof content });
    throw new Error("Evaluation returned non-string response");
  }
  return content;
}
