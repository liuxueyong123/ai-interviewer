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
  const fileRef = useRef<HTMLInputElement>(null);

  // Edit modal
  const [editModal, setEditModal] = useState<ResumeItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");
  const [loadingContent, setLoadingContent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Delete confirm modal
  const [deleteTarget, setDeleteTarget] = useState<ResumeItem | null>(null);

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

  async function openEditModal(r: ResumeItem) {
    setEditModal(r);
    setEditName(r.filename);
    setEditContent("");
    setSaveError("");
    setLoadingContent(true);
    try {
      const res = await fetch(`/api/resumes/${r.id}`);
      if (res.ok) {
        const data = await res.json();
        setEditContent(data.content || "");
      }
    } catch {
      /* ignore */
    }
    setLoadingContent(false);
  }

  function closeEditModal() {
    setEditModal(null);
    setEditContent("");
  }

  async function handleSave() {
    if (!editModal || !editName.trim()) return;
    setSaving(true);
    setSaveError("");
    const res = await fetch(`/api/resumes/${editModal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: editName.trim(), content: editContent }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setSaveError(data.error || "保存失败");
      return;
    }
    setResumes((prev) => prev.map((r) => (r.id === editModal.id ? { ...r, filename: editName.trim() } : r)));
    closeEditModal();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    setDeleting(id);
    const res = await fetch(`/api/resumes/${id}`, { method: "DELETE" });
    setDeleting(null);
    if (res.ok) setResumes((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="max-w-2xl mx-auto pt-8 pb-16 px-4">
      <div className="mb-10">
        <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">简历管理</h1>
        <p className="text-text-muted text-sm mt-1">上传和管理你的简历，面试时可直接选用</p>
      </div>

      {/* Upload area */}
      <div className="bg-surface-1 backdrop-blur-xl border border-white/8 rounded-2xl mb-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden">
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
          {error && <div className="mt-3 bg-red-500/5 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-2.5 font-medium">{error}</div>}
        </div>
      </div>

      {/* Resume list */}
      {loadingList ? (
        <Spinner className="py-16" />
      ) : resumes.length === 0 && !loading ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-2 border border-white/6 flex items-center justify-center">
            <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          </div>
          <p className="text-text-secondary font-medium mb-1">暂无简历</p>
          <p className="text-text-muted text-sm">上传 PDF 简历开始使用</p>
        </div>
      ) : (
        <div className="space-y-3">
          {resumes.map((r) => (
            <div
              key={r.id}
              onClick={() => openEditModal(r)}
              className="flex items-center justify-between bg-surface-1 backdrop-blur-md border border-white/6 rounded-2xl p-5 shadow-sm hover:shadow-[0_8px_30px_rgba(139,92,246,0.06)] hover:border-accent/30 transition-all duration-200 cursor-pointer animate-fade-in-up"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <FileIcon />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">{r.filename}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {new Date(r.createdAt).toLocaleString("zh-CN", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal(r);
                  }}
                  className="text-xs px-3 py-1.5 text-text-secondary hover:text-accent hover:bg-accent-muted rounded-lg transition-all duration-200 font-medium cursor-pointer"
                >
                  编辑
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(r);
                  }}
                  className="text-xs px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all duration-200 font-medium cursor-pointer"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={closeEditModal}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative bg-surface-1 backdrop-blur-xl border border-white/8 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 bg-gradient-to-r from-accent via-accent to-emerald-400 shrink-0" />
            <div className="p-6 overflow-y-auto flex flex-col gap-4">
              <h2 className="font-display text-lg font-semibold text-text-primary">编辑简历</h2>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">文件名</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                  }}
                  className="w-full px-3 py-2.5 bg-surface-0 border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all duration-200"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">简历内容</label>
                {loadingContent ? (
                  <Spinner className="py-8" />
                ) : (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={14}
                    className="w-full px-3 py-2.5 bg-surface-0 border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all duration-200 resize-none"
                    placeholder="简历文本内容..."
                  />
                )}
              </div>

              {saveError && <div className="bg-red-500/5 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-2.5 font-medium">{saveError}</div>}

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={closeEditModal}
                  className="flex-1 py-2.5 bg-surface-2 text-text-secondary rounded-xl hover:bg-surface-3 transition-all duration-200 text-sm font-medium cursor-pointer"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !editName.trim()}
                  className="flex-1 py-2.5 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover active:scale-[0.98] disabled:opacity-40 transition-all duration-200 text-sm cursor-pointer"
                >
                  {saving ? "保存中..." : "保存"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-surface-1 backdrop-blur-xl border border-white/8 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
              </div>
              <h3 className="font-display font-semibold text-text-primary mb-2">确认删除</h3>
              <p className="text-sm text-text-muted mb-6">
                确定要删除 <span className="text-text-secondary font-medium">「{deleteTarget.filename}」</span> 吗？此操作不可撤销。
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2.5 bg-surface-2 text-text-secondary rounded-xl hover:bg-surface-3 transition-all duration-200 text-sm font-medium cursor-pointer"
                >
                  取消
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting === deleteTarget.id}
                  className="flex-1 py-2.5 bg-danger text-white font-semibold rounded-xl hover:bg-red-600 active:scale-[0.98] disabled:opacity-40 transition-all duration-200 text-sm cursor-pointer"
                >
                  {deleting === deleteTarget.id ? "删除中..." : "确认删除"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
