export function scoreColor(s: number) {
  return s >= 80 ? "text-accent" : s >= 60 ? "text-amber-400" : "text-danger";
}
export function barColor(s: number) {
  return s >= 80 ? "bg-accent" : s >= 60 ? "bg-amber-400" : "bg-danger";
}
export function reviewBg(s: number) {
  return s >= 80 ? "bg-accent-muted border-accent/20" : s >= 60 ? "bg-amber-500/5 border-amber-500/20" : "bg-danger-muted border-danger/20";
}
export function reviewText(s: number) {
  return s >= 80 ? "text-accent" : s >= 60 ? "text-amber-400" : "text-danger";
}

export const dims = [
  {
    key: "tech" as const,
    label: "技术基础",
    icon: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z",
  },
  {
    key: "project" as const,
    label: "项目经验",
    icon: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21",
  },
  {
    key: "softSkills" as const,
    label: "软技能",
    icon: "M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z",
  },
];
