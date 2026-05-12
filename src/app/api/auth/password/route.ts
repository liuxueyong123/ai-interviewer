import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { User } from "@/entities/User";
import { getUserId } from "@/lib/utils";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { validate, ValidationError } from "@/lib/validations";
import { z } from "zod";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "当前密码不能为空"),
  newPassword: z
    .string()
    .min(8, "新密码至少8位")
    .refine((pw) => {
      let kinds = 0;
      if (/[0-9]/.test(pw)) kinds++;
      if (/[a-z]/.test(pw)) kinds++;
      if (/[A-Z]/.test(pw)) kinds++;
      if (/[^0-9a-zA-Z]/.test(pw)) kinds++;
      return kinds >= 2;
    }, "密码需包含数字、小写字母、大写字母、符号中的至少两种"),
});

export async function PATCH(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body: { currentPassword: string; newPassword: string };
  try {
    body = validate(changePasswordSchema, await request.json());
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  const ds = await getDataSource();
  const repo = ds.getRepository(User);
  const user = await repo.findOne({ where: { id: userId } });

  if (!user || !(await verifyPassword(body.currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "当前密码错误" }, { status: 400 });
  }

  user.passwordHash = await hashPassword(body.newPassword);
  await repo.save(user);

  return NextResponse.json({ success: true });
}
