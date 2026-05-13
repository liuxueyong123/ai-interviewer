import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Interview } from "@/entities/Interview";
import { Evaluation } from "@/entities/Evaluation";
import { buildEvaluationMessage, getEvaluation } from "@/lib/deepseek";
import { getUserId } from "@/lib/utils";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserId(request);

  const ds = await getDataSource();
  const { id } = await params;
  const interview = await ds.getRepository(Interview).findOne({
    where: { id: parseInt(id, 10), user: { id: userId } },
    relations: ["messages"],
  });

  if (!interview) return NextResponse.json({ error: "面试不存在" }, { status: 404 });
  if (interview.status === "done") return NextResponse.json({ error: "面试已结束" }, { status: 400 });

  await ds.getRepository(Interview).update(interview.id, { status: "evaluating" });

  // Delete any stale evaluation from a previous attempt (e.g. server restarted mid-evaluation)
  await ds.getRepository(Evaluation).delete({ interview: { id: interview.id } });

  // Fire-and-forget: run evaluation in background, do not block the response
  const conversationHistory = interview.messages
    .map((m: { role: string; content: string; questionNumber: number | null }) => {
      if (m.role === "interviewer" && m.questionNumber != null) {
        return `Q${m.questionNumber} 面试官：${m.content}`;
      }
      return `候选人：${m.content}`;
    })
    .join("\n\n");

  getEvaluation(buildEvaluationMessage(conversationHistory, interview.resumeText))
    .then(async (evalResult) => {
      const jsonStr = evalResult
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      const parsed = JSON.parse(jsonStr);

      const evaluation = ds.getRepository(Evaluation).create({
        interview: { id: interview.id },
        overallScore: parsed.overallScore,
        categories: parsed.categories,
        strengths: parsed.strengths,
        weaknesses: parsed.weaknesses,
        resumeSuggestions: parsed.resumeSuggestions,
        questionReviews: parsed.questionReviews || null,
        practiceSuggestions: parsed.practiceSuggestions || null,
      });
      await ds.getRepository(Evaluation).save(evaluation);
      await ds.getRepository(Interview).update(interview.id, { status: "done" });
    })
    .catch((err) => {
      logger.error("Background evaluation failed", { interviewId: interview.id, error: String(err) });
    });

  return NextResponse.json({ status: "evaluating" });
}
