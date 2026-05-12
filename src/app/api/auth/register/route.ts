import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { User } from "@/entities/User";
import { hashPassword, signToken } from "@/lib/auth";
import { validate, registerSchema, ValidationError } from "@/lib/validations";

export async function POST(request: NextRequest) {
  let body: { username: string; email: string; password: string };
  try {
    body = validate(registerSchema, await request.json());
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  try {
    const ds = await getDataSource();
    const repo = ds.getRepository(User);

    const existing = await repo.findOne({ where: [{ username: body.username }, { email: body.email }] });
    if (existing) {
      if (existing.username === body.username && existing.email === body.email) {
        return NextResponse.json({ error: "用户名和邮箱均已被注册" }, { status: 409 });
      }
      // Don't reveal which field is taken — prevents enumeration
      return NextResponse.json({ error: "注册失败，请更换用户名或邮箱后重试" }, { status: 409 });
    }

    const user = repo.create({
      username: body.username,
      email: body.email,
      passwordHash: await hashPassword(body.password),
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
