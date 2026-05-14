import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Interview } from "@/entities/Interview";
import { Evaluation } from "@/entities/Evaluation";
import { Message } from "@/entities/Message";
import { buildSingleQuestionEvaluationMessage, buildAggregationMessage, getEvaluation, buildRoundSummaryMessage, getRoundSummary, getPassThreshold } from "@/lib/deepseek";
import { getUserId } from "@/lib/utils";
import { logger } from "@/lib/logger";

interface QAPair {
  questionNumber: number;
  question: string;
  answer: string;
}

interface QuestionReview {
  questionNumber: number;
  question: string;
  answer: string;
  score: number;
  comment: string;
}

function extractQAPairs(messages: Message[]): QAPair[] {
  const pairs: QAPair[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (i === messages.length - 1 && msg.role === "interviewer" && msg.content.includes("面试环节已结束")) continue;
    if (msg.role === "interviewer" && msg.questionNumber != null) {
      const nextMsg = i + 1 < messages.length ? messages[i + 1] : null;
      const answer = nextMsg && nextMsg.role === "user" ? nextMsg.content : "";
      pairs.push({
        questionNumber: msg.questionNumber,
        question: msg.content,
        answer,
      });
    }
  }
  return pairs;
}

function buildConversationHistory(messages: Message[]): string {
  return messages
    .map((m) => {
      if (m.role === "interviewer") {
        const qLabel = m.questionNumber != null ? `（Q${m.questionNumber}）` : "";
        return `**面试官**${qLabel}：${m.content}`;
      }
      return `**候选人**：${m.content}`;
    })
    .join("\n\n---\n\n");
}

async function evaluateSingleQuestion(qa: QAPair, position: string): Promise<QuestionReview> {
  try {
    const result = await getEvaluation(buildSingleQuestionEvaluationMessage(qa.question, qa.answer, position));
    const jsonStr = result
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed = JSON.parse(jsonStr);
    return {
      questionNumber: qa.questionNumber,
      question: qa.question,
      answer: qa.answer,
      score: typeof parsed.score === "number" ? parsed.score : 0,
      comment: typeof parsed.comment === "string" ? parsed.comment : "",
    };
  } catch (err) {
    logger.error("Per-question evaluation failed", { questionNumber: qa.questionNumber, error: String(err) });
    return {
      questionNumber: qa.questionNumber,
      question: qa.question,
      answer: qa.answer,
      score: 0,
      comment: "评分失败",
    };
  }
}

const PER_QUESTION_CONCURRENCY = 5;

async function evaluateAllQuestions(qaPairs: QAPair[], position: string): Promise<QuestionReview[]> {
  const reviews: QuestionReview[] = [];
  for (let i = 0; i < qaPairs.length; i += PER_QUESTION_CONCURRENCY) {
    const chunk = qaPairs.slice(i, i + PER_QUESTION_CONCURRENCY);
    const results = await Promise.all(chunk.map((qa) => evaluateSingleQuestion(qa, position)));
    reviews.push(...results);
  }
  return reviews;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserId(request);

  const ds = await getDataSource();
  const { id } = await params;
  const interview = await ds.getRepository(Interview).findOne({
    where: { id: parseInt(id, 10), user: { id: userId } },
    relations: ["messages"],
  });

  if (!interview) return NextResponse.json({ error: "面试不存在" }, { status: 404 });
  if (interview.status === "done" || interview.status === "passed") return NextResponse.json({ error: "面试已结束" }, { status: 400 });
  if (interview.status === "evaluating") return NextResponse.json({ status: "evaluating" });

  const currentRound = interview.currentRound;

  await ds.getRepository(Interview).update(interview.id, { status: "evaluating" });

  // Delete stale evaluation for current round
  await ds.getRepository(Evaluation).delete({ interview: { id: interview.id }, round: currentRound });

  const roundMessages = interview.messages.filter((m) => m.round === currentRound);
  const qaPairs = extractQAPairs(roundMessages);
  const conversationHistory = buildConversationHistory(roundMessages);

  // Background evaluation: per-question → aggregate → summary
  evaluateAllQuestions(qaPairs, interview.position)
    .then(async (questionReviews) => {
      const [aggResult, roundSummary] = await Promise.all([
        getEvaluation(buildAggregationMessage(questionReviews, interview.resumeText)),
        getRoundSummary(buildRoundSummaryMessage(conversationHistory)),
      ]);

      const jsonStr = aggResult
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      const parsed = JSON.parse(jsonStr);

      const evaluation = ds.getRepository(Evaluation).create({
        interview: { id: interview.id },
        round: currentRound,
        overallScore: parsed.overallScore,
        categories: parsed.categories,
        strengths: parsed.strengths,
        weaknesses: parsed.weaknesses,
        resumeSuggestions: parsed.resumeSuggestions,
        questionReviews,
        practiceSuggestions: parsed.practiceSuggestions || null,
        roundSummary,
      });
      await ds.getRepository(Evaluation).save(evaluation);

      const threshold = getPassThreshold(interview.difficulty, currentRound);
      const passed = parsed.overallScore >= threshold;
      const hasMoreRounds = currentRound < interview.maxRounds;

      const newStatus = passed && hasMoreRounds ? "passed" : "done";
      await ds.getRepository(Interview).update(interview.id, { status: newStatus });
    })
    .catch((err) => {
      logger.error("Background evaluation failed", { interviewId: interview.id, error: String(err) });
    });

  return NextResponse.json({ status: "evaluating" });
}
