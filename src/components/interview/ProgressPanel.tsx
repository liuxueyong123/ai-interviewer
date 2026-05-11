"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface InterviewPoint {
  title: string;
  date: string;
  tech: number;
  project: number;
  softSkills: number;
}

const SERIES = [
  { key: "tech", label: "技术基础", color: "#22c55e" },
  { key: "project", label: "项目经验", color: "#3b82f6" },
  { key: "softSkills", label: "软技能", color: "#f59e0b" },
] as const;

export default function ProgressPanel({ data }: { data: InterviewPoint[] }) {
  return (
    <div className="bg-surface-1 border border-border rounded-2xl p-6 shadow-sm animate-fade-in-up">
      <h3 className="font-display text-sm font-semibold text-text-primary mb-1">成长轨迹</h3>
      <p className="text-text-muted text-xs mb-5">跨面试三项能力分数变化趋势</p>

      <div className="flex items-center gap-4 mb-4">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="title"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
            interval={0}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            tickCount={5}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              fontSize: 12,
            }}
          />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
