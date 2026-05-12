import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "@/entities/User";
import { Interview } from "@/entities/Interview";
import { Message } from "@/entities/Message";
import { Evaluation } from "@/entities/Evaluation";
import { Resume } from "@/entities/Resume";

const isProduction = process.env.NODE_ENV === "production";
const useSSL = process.env.DB_SSL === "true";

export const AppDataSource = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  username: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "interview_ai",
  synchronize: !isProduction,
  logging: false,
  entities: [User, Interview, Message, Evaluation, Resume],
  connectTimeout: 10000,
  extra: {
    connectTimeout: 10000,
    timezone: "+00:00",
    ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {}),
  },
  ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {}),
});

export async function getDataSource(): Promise<DataSource> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  return AppDataSource;
}
