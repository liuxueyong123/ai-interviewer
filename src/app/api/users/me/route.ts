import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { User } from "@/entities/User";
import { getUserId } from "@/lib/utils";
import { validate, ValidationError } from "@/lib/validations";
import { z } from "zod";

const updateProfileSchema = z.object({
  username: z.string().min(2, "用户名至少2个字符").max(50, "用户名最多50个字符").optional(),
  email: z.string().email("邮箱格式不正确").optional(),
});

export async function GET(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const ds = await getDataSource();
  const user = await ds.getRepository(User).findOne({
    where: { id: userId },
    select: ["id", "username", "email", "createdAt"],
  });
  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  return NextResponse.json(user);
}

export async function PATCH(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body: { username?: string; email?: string };
  try {
    body = validate(updateProfileSchema, await request.json());
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  if (!body.username && !body.email) {
    return NextResponse.json({ error: "至少需要修改一项" }, { status: 400 });
  }

  const ds = await getDataSource();
  const repo = ds.getRepository(User);

  if (body.username || body.email) {
    const existing = await repo.findOne({
      where: [
        ...(body.username ? [{ username: body.username }] : []),
        ...(body.email ? [{ email: body.email }] : []),
      ],
    });
    if (existing && existing.id !== userId) {
      return NextResponse.json({ error: "用户名或邮箱已被使用" }, { status: 409 });
    }
  }

  const updateData: Record<string, string> = {};
  if (body.username !== undefined) updateData.username = body.username;
  if (body.email !== undefined) updateData.email = body.email;
  await repo.update(userId, updateData);

  const updated = await repo.findOne({ where: { id: userId }, select: ["id", "username", "email"] });
  return NextResponse.json(updated);
}
