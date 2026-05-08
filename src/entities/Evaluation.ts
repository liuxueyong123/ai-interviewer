import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToOne, JoinColumn } from "typeorm";
import { Interview } from "./Interview";

@Entity()
export class Evaluation {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Interview, (interview) => interview.evaluation, { nullable: false })
  @JoinColumn({ name: "interview_id" })
  interview: Interview;

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

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
