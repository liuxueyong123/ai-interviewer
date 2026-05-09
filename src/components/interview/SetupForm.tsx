"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";

const POSITIONS = ["前端开发工程师", "后端开发工程师", "全栈开发工程师", "iOS开发工程师", "Android开发工程师", "数据工程师", "DevOps工程师", "AI/ML工程师"];

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
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">目标岗位</label>
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="w-full px-4 py-3 bg-surface-0 border border-border rounded-xl text-text-primary focus:outline-none focus:border-accent transition-all duration-200 appearance-none cursor-pointer"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
            backgroundPosition: "right 0.75rem center",
            backgroundRepeat: "no-repeat",
            backgroundSize: "1.25rem",
          }}
        >
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">上传简历 (PDF)</label>
        <div
          onClick={() => fileRef.current?.click()}
          className={`w-full h-36 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
            file ? "border-accent/50 bg-accent-muted" : "border-border hover:border-text-muted"
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setResumeText("");
            }}
          />
          {file ? (
            <>
              <svg className="w-8 h-8 text-accent mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                />
              </svg>
              <span className="text-sm text-text-secondary">{file.name}</span>
            </>
          ) : (
            <>
              <svg className="w-8 h-8 text-text-muted mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
                />
              </svg>
              <span className="text-sm text-text-muted">点击选择 PDF 文件</span>
            </>
          )}
        </div>
      </div>

      {file && !resumeText && (
        <Button onClick={handleUpload} loading={loading}>
          解析简历
        </Button>
      )}

      {resumeText && (
        <div className="flex items-center gap-2 p-4 bg-accent-muted border border-accent/20 rounded-xl">
          <svg className="w-5 h-5 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          <p className="text-sm text-accent">简历解析成功（{resumeText.length} 字符）</p>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 font-medium">{error}</div>}

      <Button onClick={handleStart} loading={loading} disabled={!resumeText}>
        开始面试
      </Button>
      <a
        href="/dashboard"
        className="block w-full text-center py-3 bg-surface-1 border border-border text-text-secondary rounded-xl hover:border-text-muted transition-all duration-200 font-display text-sm"
      >
        返回列表
      </a>
    </div>
  );
}
