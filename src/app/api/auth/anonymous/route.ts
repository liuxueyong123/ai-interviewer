import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { User } from "@/entities/User";
import { getDataSource } from "@/lib/database";
import { hashPassword, signToken } from "@/lib/auth";
import { logger } from "@/lib/logger";

const MAX_ATTEMPTS = 8;
const ANONYMOUS_EMAIL_DOMAIN = "anonymous.local";

function generateAnonymousUsername(): string {
  const suffix = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
  return `user${suffix}`;
}

function isDuplicateUserError(error: unknown): boolean {
  const candidate = error as { code?: unknown; errno?: unknown; message?: unknown };
  // MySQL-specific duplicate key detection; if the database changes (e.g. PostgreSQL),
  // update this logic to match the new driver's error codes.
  return candidate.code === "ER_DUP_ENTRY" || candidate.errno === 1062 || String(candidate.message || "").includes("Duplicate entry");
}

function createAuthResponse(user: Pick<User, "id" | "username" | "email">): NextResponse {
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
}

export async function POST(_request: NextRequest) {
  void _request;
  try {
    const ds = await getDataSource();
    const repo = ds.getRepository(User);

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const username = generateAnonymousUsername();
      const email = `${username}@${ANONYMOUS_EMAIL_DOMAIN}`;

      const existing = await repo.findOne({ where: [{ username }, { email }] });
      if (existing) continue;

      const user = repo.create({
        username,
        email,
        passwordHash: await hashPassword(randomUUID()),
      });

      try {
        const savedUser = await repo.save(user);
        return createAuthResponse(savedUser);
      } catch (error) {
        if (isDuplicateUserError(error)) continue;
        throw error;
      }
    }

    return NextResponse.json({ error: "创建匿名账号失败，请重试" }, { status: 500 });
  } catch (error) {
    logger.error("Anonymous login error", { error: String(error) });
    return NextResponse.json({ error: "服务器错误，请稍后重试" }, { status: 500 });
  }
}
