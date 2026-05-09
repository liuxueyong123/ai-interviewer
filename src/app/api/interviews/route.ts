import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Interview } from "@/entities/Interview";
import { Resume } from "@/entities/Resume";
import { getUserId } from "@/lib/utils";
import { Message } from "@/entities/Message";

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
      title: i.title || i.position,
      position: i.position,
      status: i.status,
      overallScore: i.evaluation?.overallScore ?? null,
      createdAt: i.createdAt,
    })),
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
  const count = await ds.getRepository(Interview).count({
    where: { user: { id: userId } },
  });
  const title = `面试${count + 1}: ${position}`;

  const interview = ds.getRepository(Interview).create({
    user: { id: userId },
    position,
    title,
    resumeText: finalResumeText,
    status: "ongoing",
  });
  await ds.getRepository(Interview).save(interview);

  const msgRepo = ds.getRepository(Message);
  const interviewerMsg = msgRepo.create({
    interview: { id: interview.id },
    role: "interviewer",
    content: `同学你好，很高兴见到你。我是今天${interview.position}岗位的面试官，要不咱们先聊聊你的基本情况？请简单介绍一下自己。`,
    questionNumber: 1,
  });
  await msgRepo.save(interviewerMsg);

  return NextResponse.json({ interviewId: interview.id });
}
