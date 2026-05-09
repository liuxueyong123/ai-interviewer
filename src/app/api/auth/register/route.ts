import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { User } from "@/entities/User";
import { hashPassword, signToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { username, email, password } = await request.json();

  if (!username || !email || !password) {
    return NextResponse.json({ error: "所有字段必填" }, { status: 400 });
  }

  try {
    const ds = await getDataSource();
    const repo = ds.getRepository(User);

    const existing = await repo.findOne({ where: [{ username }, { email }] });
    if (existing) {
      return NextResponse.json({ error: "用户名或邮箱已被注册" }, { status: 409 });
    }

    const user = repo.create({
      username,
      email,
      passwordHash: await hashPassword(password),
    });
    await repo.save(user);

    const token = signToken(user.id);
    const response = NextResponse.json({ token, user: { id: user.id, username: user.username, email: user.email } });
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "服务器错误，请稍后重试" }, { status: 500 });
  }
}
