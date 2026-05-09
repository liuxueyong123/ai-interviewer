import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Resume } from "@/entities/Resume";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = parseInt(request.headers.get("x-user-id") || "0", 10);
  const ds = await getDataSource();
  const { id } = await params;
  const resume = await ds.getRepository(Resume).findOne({
    where: { id: parseInt(id, 10), user: { id: userId } },
  });
  if (!resume) return NextResponse.json({ error: "简历不存在" }, { status: 404 });
  return NextResponse.json({ id: resume.id, filename: resume.filename, content: resume.content });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = parseInt(request.headers.get("x-user-id") || "0", 10);
  const { filename } = await request.json();
  if (!filename) return NextResponse.json({ error: "文件名不能为空" }, { status: 400 });

  const ds = await getDataSource();
  const { id } = await params;
  const repo = ds.getRepository(Resume);
  const resume = await repo.findOne({
    where: { id: parseInt(id, 10), user: { id: userId } },
  });
  if (!resume) return NextResponse.json({ error: "简历不存在" }, { status: 404 });

  resume.filename = filename;
  await repo.save(resume);
  return NextResponse.json({ success: true, filename: resume.filename });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = parseInt(request.headers.get("x-user-id") || "0", 10);
  const ds = await getDataSource();
  const { id } = await params;
  const repo = ds.getRepository(Resume);
  const resume = await repo.findOne({
    where: { id: parseInt(id, 10), user: { id: userId } },
  });
  if (!resume) return NextResponse.json({ error: "简历不存在" }, { status: 404 });
  await repo.remove(resume);
  return NextResponse.json({ success: true });
}
