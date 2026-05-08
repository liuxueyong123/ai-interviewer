import "reflect-metadata";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from "typeorm";
import type { Interview } from "./Interview";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 50, unique: true })
  username: string;

  @Column({ type: "varchar", length: 255, unique: true })
  email: string;

  @Column({ type: "varchar", length: 255, name: "password_hash" })
  passwordHash: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @OneToMany("Interview", "user")
  interviews: Interview[];
}
