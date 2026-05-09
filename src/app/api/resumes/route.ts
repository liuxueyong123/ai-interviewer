import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Resume } from "@/entities/Resume";
import { parsePdfBuffer } from "@/lib/pdf";
import { getUserId } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const userId = getUserId(request);
  const ds = await getDataSource();
  const resumes = await ds.getRepository(Resume).find({
    where: { user: { id: userId } },
    order: { createdAt: "DESC" },
    select: ["id", "filename", "createdAt"],
  });
  return NextResponse.json(resumes);
}

export async function POST(request: NextRequest) {
  const userId = getUserId(request);
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "请上传PDF文件" }, { status: 400 });
    if (!file.name.endsWith(".pdf")) return NextResponse.json({ error: "仅支持PDF格式" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await parsePdfBuffer(buffer);

    const ds = await getDataSource();
    const resume = ds.getRepository(Resume).create({
      user: { id: userId },
      filename: file.name,
      content: text,
    });
    await ds.getRepository(Resume).save(resume);
    return NextResponse.json({ id: resume.id, filename: resume.filename });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "解析失败";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
