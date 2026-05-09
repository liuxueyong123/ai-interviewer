import "reflect-metadata";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import type { Interview } from "./Interview";

@Entity("Message", { name: "message" })
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne("Interview", "messages", { nullable: false })
  @JoinColumn({ name: "interview_id" })
  interview: Interview;

  @Column({ type: "enum", enum: ["interviewer", "user"] })
  role: "interviewer" | "user";

  @Column({ type: "text" })
  content: string;

  @Column({ type: "int", name: "question_number", nullable: true })
  questionNumber: number | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
