import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { User } from "@/entities/User";
import { verifyPassword, signToken } from "@/lib/auth";
import { validate, loginSchema, ValidationError } from "@/lib/validations";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  let body: { login: string; password: string };
  try {
    body = validate(loginSchema, await request.json());
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  try {
    const ds = await getDataSource();
    const repo = ds.getRepository(User);

    const user = await repo.findOne({ where: [{ username: body.login }, { email: body.login }] });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return NextResponse.json({ error: "用户名/邮箱或密码错误" }, { status: 401 });
    }

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
  } catch (e) {
    logger.error("Login error", { error: String(e) });
    return NextResponse.json({ error: "服务器错误，请稍后重试" }, { status: 500 });
  }
}
