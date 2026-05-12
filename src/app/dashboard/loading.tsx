export default function DashboardLoading() {
  return (
    <div className="max-w-2xl mx-auto pt-8 pb-12 px-4 animate-pulse">
      <div className="flex items-center justify-between mb-10">
        <div>
          <div className="h-8 w-40 bg-surface-2 rounded-lg" />
          <div className="h-4 w-24 bg-surface-2 rounded mt-2" />
        </div>
        <div className="h-10 w-32 bg-surface-2 rounded-xl" />
      </div>
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-surface-1 border border-border rounded-2xl" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-surface-1 border border-border rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
