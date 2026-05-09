"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import Link from "next/link";

interface Group {
  label: string;
  options: string[];
}

const POSITION_GROUPS: Group[] = [
  {
    label: "互联网 / 信息技术",
    options: [
      "前端开发工程师",
      "后端开发工程师",
      "全栈开发工程师",
      "iOS开发工程师",
      "Android开发工程师",
      "测试工程师",
      "DevOps工程师",
      "安全工程师",
      "架构师",
      "数据库管理员(DBA)",
      "运维工程师",
      "技术总监(CTO)",
    ],
  },
  {
    label: "人工智能 / 数据",
    options: ["AI/ML工程师", "算法工程师", "NLP工程师", "计算机视觉工程师", "数据工程师", "数据分析师", "数据科学家", "AI产品经理", "大数据开发工程师"],
  },
  {
    label: "产品 / 设计",
    options: ["产品经理", "产品总监", "UI/UX设计师", "交互设计师", "视觉设计师", "用户研究员"],
  },
  {
    label: "金融 / 银行",
    options: ["金融分析师", "投资经理", "风控专员", "量化分析师", "信贷审批员", "保险精算师", "理财顾问", "合规专员", "投行分析师"],
  },
  {
    label: "医疗 / 医药",
    options: ["临床医生", "药剂师", "医学研究员", "临床数据分析师", "医疗器械工程师", "医药代表", "注册事务专员", "临床项目经理"],
  },
  {
    label: "教育 / 培训",
    options: ["教师", "课程设计师", "教务管理", "培训师", "教育顾问", "学术研究员", "留学顾问", "在线教育运营"],
  },
  {
    label: "制造 / 工业",
    options: ["机械工程师", "电气工程师", "质量工程师", "生产主管", "供应链经理", "工业设计师", "工艺工程师", "EHS工程师"],
  },
  {
    label: "建筑 / 房地产",
    options: ["建筑师", "土木工程师", "项目经理", "室内设计师", "造价工程师", "暖通工程师", "景观设计师", "房地产策划"],
  },
  {
    label: "快消 / 零售",
    options: ["品牌经理", "市场专员", "销售经理", "供应链专员", "采购经理", "电商运营", "零售店长", "客户关系管理(CRM)"],
  },
  {
    label: "咨询 / 服务",
    options: ["管理咨询师", "战略顾问", "人力资源专员(HR)", "财务顾问", "审计师", "税务顾问", "组织发展(OD)", "薪酬福利专员"],
  },
  {
    label: "媒体 / 广告 / 营销",
    options: ["内容运营", "新媒体运营", "广告策划", "视频编辑", "公关专员", "SEO/SEM专员", "品牌策划", "社群运营"],
  },
  {
    label: "法律",
    options: ["律师", "法务专员", "合规经理", "知识产权专员", "法律顾问", "公证员"],
  },
  {
    label: "能源 / 环保",
    options: ["能源工程师", "环境工程师", "新能源研发工程师", "碳管理专员", "光伏工程师", "储能工程师"],
  },
  {
    label: "物流 / 运输",
    options: ["物流经理", "供应链分析师", "仓储主管", "运输调度", "跨境电商物流", "采购专员"],
  },
  {
    label: "游戏",
    options: ["游戏策划", "游戏开发工程师", "游戏美术", "游戏运营", "Unity/Unreal工程师", "游戏音效师"],
  },
  {
    label: "汽车 / 出行",
    options: ["汽车工程师", "自动驾驶工程师", "产品经理", "嵌入式软件工程师", "车联网工程师", "质量体系工程师"],
  },
  {
    label: "政府 / 非营利",
    options: ["公务员", "项目官员", "政策研究员", "社会工作师", "公共事务专员", "基金会项目主管"],
  },
];

export default function SetupForm() {
  const router = useRouter();
  const [position, setPosition] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return POSITION_GROUPS;
    const q = search.toLowerCase();
    return POSITION_GROUPS.map((g) => ({
      ...g,
      options: g.options.filter((o) => o.toLowerCase().includes(q)),
    })).filter((g) => g.options.length > 0);
  }, [search]);

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
    if (!position) {
      setError("请选择目标岗位");
      return;
    }
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
      {/* Position selector */}
      <div ref={dropdownRef} className="relative">
        <label className="block text-sm font-medium text-text-secondary mb-2">目标岗位</label>
        <input
          type="text"
          value={open ? search : position || search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="搜索岗位（例如：前端、产品经理、金融分析师...）"
          className="w-full px-4 py-3 bg-surface-0 border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-200"
        />

        {open && (
          <div className="absolute z-50 mt-1 w-full bg-surface-1 border border-border rounded-xl shadow-lg max-h-72 overflow-y-auto">
            {filteredGroups.length === 0 ? (
              <div className="px-4 py-6 text-center text-text-muted text-sm">无匹配岗位</div>
            ) : (
              filteredGroups.map((group) => (
                <div key={group.label}>
                  <div className="px-4 py-2 text-xs font-semibold text-text-muted bg-surface-2 sticky top-0">{group.label}</div>
                  {group.options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setPosition(opt);
                        setSearch("");
                        setOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-all duration-150 hover:bg-accent-muted ${
                        position === opt ? "text-accent font-semibold bg-accent-muted" : "text-text-primary"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* PDF upload */}
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

      <Button onClick={handleStart} loading={loading} disabled={!resumeText || !position}>
        开始面试
      </Button>
      <Link
        href="/dashboard"
        className="block w-full text-center py-3 bg-surface-1 border border-border text-text-secondary rounded-xl hover:border-text-muted transition-all duration-200 font-display text-sm"
      >
        返回列表
      </Link>
    </div>
  );
}
