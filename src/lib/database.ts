import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "@/entities/User";
import { Interview } from "@/entities/Interview";
import { Message } from "@/entities/Message";
import { Evaluation } from "@/entities/Evaluation";

export const AppDataSource = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  username: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "interview_ai",
  synchronize: process.env.NODE_ENV !== "production",
  logging: false,
  entities: [User, Interview, Message, Evaluation],
});

export async function getDataSource(): Promise<DataSource> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  return AppDataSource;
}
