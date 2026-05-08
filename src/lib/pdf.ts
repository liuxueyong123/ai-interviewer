import { PDFParse } from "pdf-parse";
import path from "path";

// Configure PDF.js worker for Node.js server-side usage
PDFParse.setWorker(
  path.join(process.cwd(), "public", "pdf.worker.min.mjs")
);

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  if (buffer.length > MAX_SIZE) {
    throw new Error("PDF文件大小不能超过5MB");
  }
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text;
}
