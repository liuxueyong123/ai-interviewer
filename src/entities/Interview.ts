import "reflect-metadata";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, OneToOne, JoinColumn } from "typeorm";
import type { User } from "./User";
import type { Message } from "./Message";
import type { Evaluation } from "./Evaluation";

@Entity()
export class Interview {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne("User", "interviews", { nullable: false })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ type: "varchar", length: 100 })
  position: string;

  @Column({ type: "text", name: "resume_text" })
  resumeText: string;

  @Column({ type: "enum", enum: ["ongoing", "done"], default: "ongoing" })
  status: "ongoing" | "done";

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @OneToMany("Message", "interview")
  messages: Message[];

  @OneToOne("Evaluation", "interview")
  evaluation: Evaluation;
}
