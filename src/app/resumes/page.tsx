"use client";

import { useState, useEffect, useRef } from "react";
import Spinner from "@/components/ui/Spinner";
import { FileIcon } from "@/components/ui/Icons";

interface ResumeItem {
  id: number;
  filename: string;
  createdAt: string;
}

export default function ResumesPage() {
  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/resumes")
      .then((r) => r.json())
      .then(setResumes)
      .catch(() => setError("加载失败"))
      .finally(() => setLoadingList(false));
  }, []);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/resumes", { method: "POST", body: fd });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setResumes((prev) => [{ id: data.id, filename: data.filename, createdAt: new Date().toISOString() }, ...prev]);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    const res = await fetch(`/api/resumes/${id}`, { method: "DELETE" });
    setDeleting(null);
    if (res.ok) setResumes((prev) => prev.filter((r) => r.id !== id));
  }

  function startEdit(r: ResumeItem) {
    setEditing(r.id);
    setEditName(r.filename);
  }

  async function saveEdit() {
    if (editing === null || !editName.trim()) return;
    const res = await fetch(`/api/resumes/${editing}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: editName.trim() }),
    });
    if (res.ok) {
      setResumes((prev) => prev.map((r) => (r.id === editing ? { ...r, filename: editName.trim() } : r)));
    }
    setEditing(null);
  }

  return (
    <div className="max-w-2xl mx-auto pt-12 pb-16 px-4">
      <div className="mb-10">
        <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">简历管理</h1>
        <p className="text-text-muted text-sm mt-1">上传和管理你的简历，面试时可直接选用</p>
      </div>

      {/* Upload area — auto-upload on select */}
      <div className="bg-surface-1 border border-border rounded-2xl mb-6 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-accent via-accent to-emerald-400" />
        <div className="p-6">
        <div
          onClick={() => fileRef.current?.click()}
          className="w-full h-28 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-accent hover:bg-accent-muted transition-all duration-200"
        >
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileSelect} />
          {loading ? (
            <span className="text-sm text-text-muted">上传解析中...</span>
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
              <span className="text-sm text-text-muted">点击选择 PDF 文件，自动上传并解析</span>
            </>
          )}
        </div>
        {error && <div className="mt-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-2.5 font-medium">{error}</div>}
        </div>
      </div>

      {/* Resume list */}
      {loadingList ? (
        <Spinner className="py-16" />
      ) : resumes.length === 0 && !loading ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-2 border border-border flex items-center justify-center">
            <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <p className="text-text-secondary font-medium mb-1">暂无简历</p>
          <p className="text-text-muted text-sm">上传 PDF 简历开始使用</p>
        </div>
      ) : (
        <div className="space-y-3">
          {resumes.map((r) => (
            <div key={r.id} className="flex items-center justify-between bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <FileIcon />
                <div className="min-w-0 flex-1">
                  {editing === r.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") setEditing(null);
                      }}
                      className="w-full text-sm font-medium bg-surface-0 border border-accent rounded-lg px-2 py-1 text-text-primary focus:outline-none"
                      autoFocus
                    />
                  ) : (
                    <p className="text-sm font-medium text-text-primary truncate cursor-pointer hover:text-accent transition-all duration-200" onClick={() => startEdit(r)} title="点击编辑名称">
                      {r.filename}
                    </p>
                  )}
                  <p className="text-xs text-text-muted mt-0.5">{new Date(r.createdAt).toLocaleString("zh-CN", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => startEdit(r)} className="text-xs px-2 py-1.5 text-text-muted hover:text-text-primary transition-all duration-200 cursor-pointer">
                  重命名
                </button>
                <button
                  onClick={() => handleDelete(r.id)}
                  disabled={deleting === r.id}
                  className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-all duration-200 font-medium cursor-pointer"
                >
                  {deleting === r.id ? "删除中..." : "删除"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
