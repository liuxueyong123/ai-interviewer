import { scoreColor } from "./scoreUtils";

export function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  const circumference = 2 * Math.PI * 42;
  const offset = circumference * (1 - score / 100);
  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90 w-full h-full" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="6" />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className={`font-display text-4xl font-bold ${scoreColor(score)}`}>{score}</span>
    </div>
  );
}
