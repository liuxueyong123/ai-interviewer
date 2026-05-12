import { PDFParse } from "pdf-parse";
import path from "path";
import fs from "fs";
import "@napi-rs/canvas";

function resolveWorkerPath(): string {
  const candidates = [
    path.join(process.cwd(), "public", "pdf.worker.min.mjs"),
    path.join(__dirname, "..", "..", "public", "pdf.worker.min.mjs"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

PDFParse.setWorker(resolveWorkerPath());

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  if (buffer.length > MAX_SIZE) {
    throw new Error("PDF文件大小不能超过5MB");
  }
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text;
}
