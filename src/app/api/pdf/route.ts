import { NextRequest, NextResponse } from "next/server";
import { parsePdfBuffer } from "@/lib/pdf";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "请上传PDF文件" }, { status: 400 });
    }

    if (!file.name.endsWith(".pdf")) {
      return NextResponse.json({ error: "仅支持PDF格式" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await parsePdfBuffer(buffer);

    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "解析失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
