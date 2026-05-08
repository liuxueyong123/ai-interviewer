import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { User } from "@/entities/User";
import { hashPassword, signToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { username, email, password } = await request.json();

  if (!username || !email || !password) {
    return NextResponse.json({ error: "所有字段必填" }, { status: 400 });
  }

  const ds = await getDataSource();
  const repo = ds.getRepository(User);

  const existing = await repo.findOne({ where: [{ username }, { email }] });
  if (existing) {
    return NextResponse.json({ error: "用户名或邮箱已被注册" }, { status: 409 });
  }

  const user = repo.create({
    username,
    email,
    passwordHash: hashPassword(password),
  });
  await repo.save(user);

  const token = signToken(user.id);
  return NextResponse.json({ token, user: { id: user.id, username: user.username, email: user.email } });
}
