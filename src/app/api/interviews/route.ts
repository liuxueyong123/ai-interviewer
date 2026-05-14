import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Interview } from "@/entities/Interview";
import { Resume } from "@/entities/Resume";
import { getUserId } from "@/lib/utils";
import { validate, createInterviewSchema, ValidationError } from "@/lib/validations";
import { Message } from "@/entities/Message";

export async function GET(request: NextRequest) {
  const userId = getUserId(request);

  const ds = await getDataSource();
  const interviews = await ds.getRepository(Interview).find({
    where: { user: { id: userId } },
    order: { createdAt: "DESC" },
    relations: ["evaluations"],
  });

  return NextResponse.json(
    interviews.map((i) => {
      const evals = i.evaluations ?? [];
      const avg = (arr: number[]) => Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);
      const overallScore = evals.length > 0 ? avg(evals.map((e) => e.overallScore)) : null;
      const categories =
        evals.length > 0
          ? { tech: avg(evals.map((e) => e.categories?.tech ?? 0)), project: avg(evals.map((e) => e.categories?.project ?? 0)), softSkills: avg(evals.map((e) => e.categories?.softSkills ?? 0)) }
          : null;
      return {
        id: i.id,
        title: i.title || i.position,
        position: i.position,
        status: i.status,
        currentRound: i.currentRound,
        maxRounds: i.maxRounds,
        overallScore,
        categories,
        mode: i.mode,
        createdAt: i.createdAt,
      };
    }),
  );
}

export async function POST(request: NextRequest) {
  const userId = getUserId(request);
  let body: { position?: string; resumeText?: string; resumeId?: number; questionCount?: number; difficulty?: "junior" | "mid" | "senior"; maxRounds?: number; mode?: "text" | "voice"; prevInterviewId?: number };
  try {
    body = validate(createInterviewSchema, await request.json());
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  const ds = await getDataSource();

  let { position, resumeText, resumeId, questionCount = 12, difficulty = "mid", maxRounds = 2, mode } = body;
  let finalResumeText = resumeText || "";

  if (body.prevInterviewId) {
    const prev = await ds.getRepository(Interview).findOne({
      where: { id: body.prevInterviewId, user: { id: userId } },
    });
    if (!prev) {
      return NextResponse.json({ error: "面试记录不存在" }, { status: 404 });
    }
    position = prev.position;
    finalResumeText = prev.resumeText;
    questionCount = prev.questionCount;
    difficulty = prev.difficulty;
    maxRounds = prev.maxRounds;
    mode = prev.mode;
  }

  if (!position) {
    return NextResponse.json({ error: "请选择目标岗位" }, { status: 400 });
  }

  if (resumeId) {
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
    questionCount,
    difficulty,
    currentRound: 1,
    maxRounds,
    mode: mode || "text",
  });
  await ds.getRepository(Interview).save(interview);

  const msgRepo = ds.getRepository(Message);
  const interviewerMsg = msgRepo.create({
    interview: { id: interview.id },
    role: "interviewer",
    content: `同学你好，很高兴见到你。我是今天${interview.position}岗位的面试官，要不咱们先聊聊你的基本情况？请简单介绍一下自己。`,
    round: 1,
    questionNumber: 1,
  });
  await msgRepo.save(interviewerMsg);

  return NextResponse.json({ interviewId: interview.id, mode: mode || "text" });
}
