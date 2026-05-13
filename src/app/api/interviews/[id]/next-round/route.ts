import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Interview } from "@/entities/Interview";
import { Message } from "@/entities/Message";
import { getUserId } from "@/lib/utils";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserId(request);

  const ds = await getDataSource();
  const { id } = await params;
  const interview = await ds.getRepository(Interview).findOne({
    where: { id: parseInt(id, 10), user: { id: userId } },
  });

  if (!interview) return NextResponse.json({ error: "面试不存在" }, { status: 404 });
  if (interview.status !== "passed") {
    return NextResponse.json({ error: "当前状态不允许进入下一轮" }, { status: 400 });
  }

  const nextRound = interview.currentRound + 1;
  if (nextRound > interview.maxRounds) {
    return NextResponse.json({ error: "已达到最大轮数" }, { status: 400 });
  }

  await ds.getRepository(Interview).update(interview.id, {
    status: "ongoing",
    currentRound: nextRound,
  });

  const msgRepo = ds.getRepository(Message);
  const interviewerMsg = msgRepo.create({
    interview: { id: interview.id },
    role: "interviewer",
    content: `欢迎进入第 ${nextRound} 轮面试！接下来我们会更深入地聊一聊，请你先做个简单的自我介绍。`,
    round: nextRound,
    questionNumber: 1,
  });
  await msgRepo.save(interviewerMsg);

  logger.info("Next round started", { interviewId: interview.id, round: nextRound });

  return NextResponse.json({
    interviewId: interview.id,
    currentRound: nextRound,
  });
}
