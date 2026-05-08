"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";

const POSITIONS = [
  "前端开发工程师",
  "后端开发工程师",
  "全栈开发工程师",
  "iOS开发工程师",
  "Android开发工程师",
  "数据工程师",
  "DevOps工程师",
  "AI/ML工程师",
];

export default function SetupForm() {
  const router = useRouter();
  const [position, setPosition] = useState(POSITIONS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) return;
    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/pdf", { method: "POST", body: formData });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }
    setResumeText(data.text);
  }

  async function handleStart() {
    if (!resumeText) {
      setError("请先上传简历");
      return;
    }
    setLoading(true);

    const res = await fetch("/api/interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position, resumeText }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    router.push(`/interview/chat?id=${data.interviewId}`);
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <label className="block text-sm font-medium mb-1">目标岗位</label>
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {POSITIONS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">上传简历 (PDF)</label>
        <div
          onClick={() => fileRef.current?.click()}
          className={`w-full h-32 border-2 border-dashed rounded-xl flex items-center justify-center cursor-pointer transition-colors ${file ? "border-green-400 bg-green-50" : "border-gray-300 hover:border-indigo-400"}`}
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => { setFile(e.target.files?.[0] || null); setResumeText(""); }}
          />
          <span className="text-sm text-gray-500">
            {file ? `📄 ${file.name}` : "点击选择 PDF 文件"}
          </span>
        </div>
      </div>

      {file && !resumeText && (
        <Button onClick={handleUpload} loading={loading}>
          解析简历
        </Button>
      )}

      {resumeText && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700">简历解析成功（{resumeText.length} 字符）</p>
        </div>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <Button onClick={handleStart} loading={loading} disabled={!resumeText}>
        开始面试
      </Button>
    </div>
  );
}
