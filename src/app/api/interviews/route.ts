import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Interview } from "@/entities/Interview";

function getUserId(request: NextRequest): number {
  return parseInt(request.headers.get("x-user-id") || "0", 10);
}

export async function GET(request: NextRequest) {
  const userId = getUserId(request);

  const ds = await getDataSource();
  const interviews = await ds.getRepository(Interview).find({
    where: { user: { id: userId } },
    order: { createdAt: "DESC" },
    relations: ["evaluation"],
  });

  return NextResponse.json(
    interviews.map((i) => ({
      id: i.id,
      position: i.position,
      status: i.status,
      overallScore: i.evaluation?.overallScore ?? null,
      createdAt: i.createdAt,
    }))
  );
}

export async function POST(request: NextRequest) {
  const userId = getUserId(request);
  const { position, resumeText } = await request.json();
  if (!position || !resumeText) {
    return NextResponse.json({ error: "岗位和简历不能为空" }, { status: 400 });
  }

  const ds = await getDataSource();
  const interview = ds.getRepository(Interview).create({
    user: { id: userId },
    position,
    resumeText,
    status: "ongoing",
  });
  await ds.getRepository(Interview).save(interview);

  return NextResponse.json({ interviewId: interview.id });
}
