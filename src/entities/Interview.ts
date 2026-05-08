import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, OneToOne, JoinColumn } from "typeorm";
import { User } from "./User";
import { Message } from "./Message";
import { Evaluation } from "./Evaluation";

@Entity()
export class Interview {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.interviews, { nullable: false })
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

  @OneToMany(() => Message, (message) => message.interview)
  messages: Message[];

  @OneToOne(() => Evaluation, (evaluation) => evaluation.interview)
  evaluation: Evaluation;
}
