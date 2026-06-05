import { ScoreRing } from "./ScoreRing";
import { CategoryBars } from "./CategoryBars";
import { EvaluationText } from "./EvaluationText";

export { ScoreRing } from "./ScoreRing";
export { CategoryBars } from "./CategoryBars";
export { EvaluationText } from "./EvaluationText";
export { InterviewReview } from "./InterviewReview";
export { PracticePanel } from "./PracticePanel";
export { scoreColor, barColor, reviewBg, reviewText } from "./scoreUtils";

interface ScoreCardProps {
  heading: string;
  date: string;
  overallScore: number;
  categories: { tech: number; project: number; softSkills: number };
  strengths: string;
  weaknesses: string;
  resumeSuggestions: string;
}

export default function ScoreCard({ heading, date, overallScore, categories, strengths, weaknesses, resumeSuggestions }: ScoreCardProps) {
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="text-center">
        <p className="text-text-muted text-xs mb-2">{date}</p>
        <h1 className="font-display text-xl font-bold text-text-primary">{heading} 面试评分</h1>
      </div>

      <div className="flex justify-center">
        <ScoreRing score={overallScore} />
      </div>

      <CategoryBars categories={categories} />
      <EvaluationText strengths={strengths} weaknesses={weaknesses} resumeSuggestions={resumeSuggestions} showResumeSuggestions={true} />
    </div>
  );
}
