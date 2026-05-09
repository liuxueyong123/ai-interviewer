import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Interview } from "@/entities/Interview";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = parseInt(request.headers.get("x-user-id") || "0", 10);

  const ds = await getDataSource();
  const { id } = await params;
  const interview = await ds.getRepository(Interview).findOne({
    where: { id: parseInt(id, 10), user: { id: userId } },
    relations: ["messages", "evaluation"],
  });

  if (!interview) {
    return NextResponse.json({ error: "面试不存在" }, { status: 404 });
  }

  return NextResponse.json({
    interview: {
      id: interview.id,
      position: interview.position,
      status: interview.status,
      createdAt: interview.createdAt,
    },
    messages: interview.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      questionNumber: m.questionNumber,
      createdAt: m.createdAt,
    })),
    evaluation: interview.evaluation
      ? {
          overallScore: interview.evaluation.overallScore,
          categories: interview.evaluation.categories,
          strengths: interview.evaluation.strengths,
          weaknesses: interview.evaluation.weaknesses,
          resumeSuggestions: interview.evaluation.resumeSuggestions,
        }
      : null,
  });
}
