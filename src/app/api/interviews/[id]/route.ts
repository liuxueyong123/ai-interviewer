import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Interview } from "@/entities/Interview";
import { getUserId } from "@/lib/utils";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserId(request);

  const ds = await getDataSource();
  const { id } = await params;
  const interview = await ds.getRepository(Interview).findOne({
    where: { id: parseInt(id, 10), user: { id: userId } },
    relations: ["messages", "evaluations"],
  });

  if (!interview) {
    return NextResponse.json({ error: "面试不存在" }, { status: 404 });
  }

  return NextResponse.json({
    interview: {
      id: interview.id,
      title: interview.title || interview.position,
      position: interview.position,
      status: interview.status,
      resumeText: interview.resumeText,
      questionCount: interview.questionCount,
      difficulty: interview.difficulty,
      currentRound: interview.currentRound,
      maxRounds: interview.maxRounds,
      mode: interview.mode,
      createdAt: interview.createdAt,
    },
    messages: interview.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      round: m.round,
      questionNumber: m.questionNumber,
      createdAt: m.createdAt,
    })),
    evaluations: interview.evaluations
      .sort((a, b) => a.round - b.round)
      .map((e) => ({
        round: e.round,
        overallScore: e.overallScore,
        categories: e.categories,
        strengths: e.strengths,
        weaknesses: e.weaknesses,
        resumeSuggestions: e.resumeSuggestions,
        questionReviews: e.questionReviews,
        practiceSuggestions: e.practiceSuggestions,
        roundSummary: e.roundSummary,
      })),
  });
}
