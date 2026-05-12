import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Resume } from "@/entities/Resume";
import { getUserId } from "@/lib/utils";
import { validate, updateResumeSchema, ValidationError } from "@/lib/validations";

function getResumeId(params: { id: string }) {
  return parseInt(params.id, 10);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserId(request);
  const ds = await getDataSource();
  const { id } = await params;
  const resume = await ds.getRepository(Resume).findOne({
    where: { id: getResumeId({ id }), user: { id: userId } },
  });
  if (!resume) return NextResponse.json({ error: "简历不存在" }, { status: 404 });
  return NextResponse.json({ id: resume.id, filename: resume.filename, content: resume.content });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserId(request);
  let body: { filename?: string; content?: string };
  try {
    body = validate(updateResumeSchema, await request.json());
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  const ds = await getDataSource();
  const { id } = await params;
  const repo = ds.getRepository(Resume);
  const resume = await repo.findOne({
    where: { id: getResumeId({ id }), user: { id: userId } },
  });
  if (!resume) return NextResponse.json({ error: "简历不存在" }, { status: 404 });

  if (body.filename !== undefined) {
    resume.filename = body.filename.trim();
  }
  if (body.content !== undefined) {
    resume.content = body.content;
  }

  await repo.save(resume);
  return NextResponse.json({ success: true, filename: resume.filename, content: resume.content });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserId(request);
  const ds = await getDataSource();
  const { id } = await params;
  const repo = ds.getRepository(Resume);
  const resume = await repo.findOne({
    where: { id: getResumeId({ id }), user: { id: userId } },
  });
  if (!resume) return NextResponse.json({ error: "简历不存在" }, { status: 404 });
  await repo.remove(resume);
  return NextResponse.json({ success: true });
}
