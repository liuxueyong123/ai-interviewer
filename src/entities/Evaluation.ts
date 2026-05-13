import "reflect-metadata";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import type { Interview } from "./Interview";

@Entity("Evaluation", { name: "evaluation" })
export class Evaluation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne("Interview", "evaluations", { nullable: false })
  @JoinColumn({ name: "interview_id" })
  interview: Interview;

  @Column({ type: "int", default: 1 })
  round: number;

  @Column({ type: "text", name: "round_summary", nullable: true })
  roundSummary: string | null;

  @Column({ type: "int", name: "overall_score" })
  overallScore: number;

  @Column({ type: "json" })
  categories: { tech: number; project: number; softSkills: number };

  @Column({ type: "text" })
  strengths: string;

  @Column({ type: "text" })
  weaknesses: string;

  @Column({ type: "text", name: "resume_suggestions" })
  resumeSuggestions: string;

  @Column({ type: "json", name: "question_reviews", nullable: true })
  questionReviews: Array<{ questionNumber: number; question: string; score: number; comment: string }> | null;

  @Column({ type: "json", name: "practice_suggestions", nullable: true })
  practiceSuggestions: Array<{ area: string; description: string; suggestion: string }> | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
