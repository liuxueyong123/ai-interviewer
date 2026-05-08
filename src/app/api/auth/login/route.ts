import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { User } from "@/entities/User";
import { verifyPassword, signToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: "用户名和密码必填" }, { status: 400 });
  }

  const ds = await getDataSource();
  const repo = ds.getRepository(User);

  const user = await repo.findOne({ where: { username } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
  }

  const token = signToken(user.id);
  return NextResponse.json({ token, user: { id: user.id, username: user.username, email: user.email } });
}
