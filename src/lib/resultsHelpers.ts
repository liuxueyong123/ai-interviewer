import type { StepInfo } from "@/components/interview/Steps";

export function deriveSteps(maxRounds: number, currentRound: number, status: string, evaluations: Array<{ round: number; overallScore: number }>): StepInfo[] {
  const evalMap = new Map(evaluations.map((e) => [e.round, e]));
  const steps: StepInfo[] = [];
  for (let r = 1; r <= maxRounds; r++) {
    const ev = evalMap.get(r);
    if (ev) {
      steps.push({ round: r, state: "completed", score: ev.overallScore, isCurrentPassed: false });
    } else if (r === currentRound && status === "evaluating") {
      steps.push({ round: r, state: "evaluating", isCurrentPassed: false });
    } else {
      const isNextAvailable = r === currentRound + 1 && status === "passed";
      steps.push({ round: r, state: "locked", isCurrentPassed: isNextAvailable });
    }
  }
  return steps;
}

export function deriveStatusMessage(status: string, currentRound: number, maxRounds: number, evaluationsLength: number): string | undefined {
  if (status === "evaluating") return `第 ${currentRound} 轮评估中，AI 正在分析面试表现...`;
  if (status === "passed") return `已通过第 ${currentRound} 轮，可进入第 ${currentRound + 1} 轮面试`;
  if (status === "done") {
    if (evaluationsLength < maxRounds) return `未达到第 ${currentRound} 轮通过分数，面试结束`;
    if (evaluationsLength === maxRounds) return "恭喜！已通过全部轮次";
  }
  return undefined;
}
