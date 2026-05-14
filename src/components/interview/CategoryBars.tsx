import { scoreColor, barColor, dims } from "./scoreUtils";

export function CategoryBars({ categories }: { categories: { tech: number; project: number; softSkills: number } }) {
  return (
    <div className="bg-surface-1 border border-border rounded-2xl p-6 space-y-5 shadow-sm">
      {dims.map(({ key, label, icon }) => (
        <div key={key}>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-text-secondary font-medium inline-flex items-center gap-1.5">
              <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
              </svg>
              {label}
            </span>
            <span className={`font-display font-bold ${scoreColor(categories[key])}`}>{categories[key]}</span>
          </div>
          <div className="w-full h-2.5 bg-surface-2 rounded-full overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-700 ease-out ${barColor(categories[key])}`}
              style={{ width: `${categories[key]}%`, boxShadow: `0 0 8px rgba(${categories[key] >= 80 ? "34,197,94" : categories[key] >= 60 ? "245,158,11" : "239,68,68"}, 0.15)` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
