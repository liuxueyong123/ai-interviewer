import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Interview } from "@/entities/Interview";
import { Resume } from "@/entities/Resume";

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
  const { position, resumeText, resumeId } = await request.json();

  if (!position) {
    return NextResponse.json({ error: "请选择目标岗位" }, { status: 400 });
  }

  let finalResumeText = resumeText || "";

  // If resumeId is provided, fetch the saved resume content
  if (resumeId) {
    const ds = await getDataSource();
    const resume = await ds.getRepository(Resume).findOne({
      where: { id: parseInt(String(resumeId), 10), user: { id: userId } },
    });
    if (!resume) {
      return NextResponse.json({ error: "简历不存在" }, { status: 404 });
    }
    finalResumeText = resume.content;
  }

  if (!finalResumeText) {
    return NextResponse.json({ error: "简历内容不能为空" }, { status: 400 });
  }

  const ds = await getDataSource();
  const interview = ds.getRepository(Interview).create({
    user: { id: userId },
    position,
    resumeText: finalResumeText,
    status: "ongoing",
  });
  await ds.getRepository(Interview).save(interview);

  return NextResponse.json({ interviewId: interview.id });
}
