import "reflect-metadata";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn } from "typeorm";
import type { User } from "./User";
import type { Message } from "./Message";
import type { Evaluation } from "./Evaluation";

@Entity("Interview", { name: "interview" })
export class Interview {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne("User", "interviews", { nullable: false })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ type: "varchar", length: 100 })
  position: string;

  @Column({ type: "varchar", length: 200 })
  title: string;

  @Column({ type: "text", name: "resume_text" })
  resumeText: string;

  @Column({ type: "enum", enum: ["ongoing", "evaluating", "passed", "done"], default: "ongoing" })
  status: "ongoing" | "evaluating" | "passed" | "done";

  @Column({ type: "int", name: "question_count", default: 12 })
  questionCount: number;

  @Column({ type: "varchar", length: 20, name: "difficulty", default: "mid" })
  difficulty: "junior" | "mid" | "senior";

  @Column({ type: "int", name: "current_round", default: 1 })
  currentRound: number;

  @Column({ type: "int", name: "max_rounds", default: 2 })
  maxRounds: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @OneToMany("Message", "interview")
  messages: Message[];

  @OneToMany("Evaluation", "interview")
  evaluations: Evaluation[];
}
