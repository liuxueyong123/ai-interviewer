import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Interview } from "@/entities/Interview";
import { verifyToken } from "@/lib/auth";

function getUserId(request: NextRequest): number | null {
  const token = request.cookies.get("token")?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

export async function GET(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

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
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

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
