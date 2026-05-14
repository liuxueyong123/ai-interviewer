"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface InterviewPoint {
  label: string;
  title: string;
  date: string;
  score: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: InterviewPoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="bg-surface-1 border border-border rounded-xl p-3 shadow-md text-xs">
      <p className="font-semibold text-text-primary mb-0.5">{point.title}</p>
      <p className="text-text-muted mb-1">{new Date(point.date).toLocaleDateString("zh-CN")}</p>
      <p className="text-accent font-display font-bold text-sm">{point.score} 分</p>
    </div>
  );
}

export default function ProgressPanel({ data }: { data: InterviewPoint[] }) {
  if (!data.length) return null;

  return (
    <div className="bg-surface-1 border border-border rounded-2xl p-6 shadow-sm animate-fade-in-up">
      <h3 className="font-display text-sm font-semibold text-text-primary mb-1">成长轨迹</h3>
      <p className="text-text-muted text-xs mb-5">历次面试综合平均分变化趋势</p>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#252d48" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={{ stroke: "#252d48" }}
            interval={0}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
            tickCount={5}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={{ r: 4, fill: "#8b5cf6", strokeWidth: 0 }}
            activeDot={{ r: 6, strokeWidth: 0, fill: "#a78bfa" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
