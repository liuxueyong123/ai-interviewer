import SetupForm from "@/components/interview/SetupForm";

export default function InterviewSetupPage() {
  return (
    <div className="max-w-lg mx-auto py-16 px-4">
      <h1 className="text-2xl font-bold text-center mb-2">开始面试</h1>
      <p className="text-center text-gray-500 mb-8">选择目标岗位并上传简历，AI 将为你模拟专业面试</p>
      <SetupForm />
    </div>
  );
}
