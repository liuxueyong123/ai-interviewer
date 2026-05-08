import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Interview } from "@/entities/Interview";
import { verifyToken } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("token")?.value;
  if (!token) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const ds = await getDataSource();
  const { id } = await params;
  const interview = await ds.getRepository(Interview).findOne({
    where: { id: parseInt(id, 10), user: { id: payload.userId } },
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
