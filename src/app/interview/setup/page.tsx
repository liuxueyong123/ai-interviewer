import SetupForm from "@/components/interview/SetupForm";

export default function InterviewSetupPage() {
  return (
    <div className="max-w-lg mx-auto py-16 px-4">
      <div className="text-center mb-10">
        <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">开始面试</h1>
        <p className="text-text-muted text-sm mt-2">选择目标岗位并上传简历，AI 将为你模拟专业面试</p>
      </div>
      <div className="bg-surface-1 border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-accent via-accent to-emerald-400" />
        <div className="p-6">
          <SetupForm />
        </div>
      </div>
    </div>
  );
}
