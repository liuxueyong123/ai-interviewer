import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Interview } from "@/entities/Interview";
import { Evaluation } from "@/entities/Evaluation";
import { buildEvaluationPrompt, getEvaluation } from "@/lib/deepseek";
import { getUserId } from "@/lib/utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserId(request);

  const ds = await getDataSource();
  const { id } = await params;
  const interview = await ds.getRepository(Interview).findOne({
    where: { id: parseInt(id, 10), user: { id: userId } },
    relations: ["messages"],
  });

  if (!interview) return NextResponse.json({ error: "面试不存在" }, { status: 404 });
  if (interview.status === "done") return NextResponse.json({ error: "面试已结束" }, { status: 400 });

  // Build conversation history text
  const conversationHistory = interview.messages
    .map((m) => `${m.role === "interviewer" ? "面试官" : "候选人"}：${m.content}`)
    .join("\n\n");

  const evalResult = await getEvaluation(buildEvaluationPrompt(conversationHistory, interview.resumeText));

  // Parse the JSON response — strip potential markdown code fences
  const jsonStr = evalResult.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(jsonStr);

  const evaluation = ds.getRepository(Evaluation).create({
    interview: { id: interview.id },
    overallScore: parsed.overallScore,
    categories: parsed.categories,
    strengths: parsed.strengths,
    weaknesses: parsed.weaknesses,
    resumeSuggestions: parsed.resumeSuggestions,
    questionReviews: parsed.questionReviews || null,
  });
  await ds.getRepository(Evaluation).save(evaluation);

  await ds.getRepository(Interview).update(interview.id, { status: "done" });

  return NextResponse.json({ evaluation: parsed });
}
