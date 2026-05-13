import { z } from "zod";

// ── Auth ──
export const loginSchema = z.object({
  login: z.string().min(1, "用户名/邮箱不能为空"),
  password: z.string().min(1, "密码不能为空"),
});

export const registerSchema = z.object({
  username: z.string().min(2, "用户名至少2个字符").max(50, "用户名最多50个字符"),
  email: z.string().email("邮箱格式不正确"),
  password: z
    .string()
    .min(8, "密码至少8位")
    .refine((pw) => {
      let kinds = 0;
      if (/[0-9]/.test(pw)) kinds++;
      if (/[a-z]/.test(pw)) kinds++;
      if (/[A-Z]/.test(pw)) kinds++;
      if (/[^0-9a-zA-Z]/.test(pw)) kinds++;
      return kinds >= 2;
    }, "密码需包含数字、小写字母、大写字母、符号中的至少两种"),
});

// ── Chat ──
export const chatSchema = z.object({
  interviewId: z.number().int().positive("无效的面试ID"),
  message: z.string().min(1, "消息不能为空"),
  hint: z.boolean().optional(),
});

// ── Interviews ──
export const createInterviewSchema = z.object({
  position: z.string().min(1, "请选择目标岗位").optional(),
  resumeText: z.string().optional(),
  resumeId: z.number().int().positive().optional(),
  questionCount: z.number().int().min(1).max(50).optional(),
  difficulty: z.enum(["junior", "mid", "senior"]).optional(),
  maxRounds: z.number().int().min(1).max(3).optional(),
  prevInterviewId: z.number().int().positive().optional(),
}).refine(
  (data) => !!(data.position || data.prevInterviewId),
  { message: "请选择目标岗位", path: ["position"] },
);

// ── Resumes ──
export const updateResumeSchema = z.object({
  filename: z.string().min(1, "文件名不能为空").optional(),
  content: z.string().optional(),
});

// ── Helper ──
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues.map((i) => i.message).join("; ");
    throw new ValidationError(message);
  }
  return result.data;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
