import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { User } from "@/entities/User";
import { getUserId } from "@/lib/utils";
import { hashPassword } from "@/lib/auth";
import { validate, ValidationError, passwordRefinement } from "@/lib/validations";
import { z } from "zod";

const setPasswordSchema = z.object({
  newPassword: z.string().min(8, "新密码至少8位").superRefine(passwordRefinement),
});

export async function PATCH(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body: { newPassword: string };
  try {
    body = validate(setPasswordSchema, await request.json());
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  const ds = await getDataSource();
  const repo = ds.getRepository(User);
  const user = await repo.findOne({ where: { id: userId } });

  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  // Use repo.update() instead of spread+save to avoid losing the TypeORM entity prototype.
  await repo.update(userId, { passwordHash: await hashPassword(body.newPassword) });

  return NextResponse.json({ success: true });
}
