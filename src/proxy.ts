import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { logger, requestDuration } from "@/lib/logger";

const publicPaths = ["/login", "/register", "/api/auth/login", "/api/auth/register", "/api/auth/logout"];

export function proxy(request: NextRequest) {
  const start = Date.now();
  const { pathname } = request.nextUrl;

  if (publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("token")?.value;
  const payload = token ? verifyToken(token) : null;

  if (!payload) {
    if (pathname.startsWith("/api/")) {
      logger.warn("Unauthenticated API request", { method: request.method, path: pathname });
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  logger.info(`${request.method} ${pathname}`, { userId: payload.userId, ...requestDuration(start) });

  const response = NextResponse.next();
  response.headers.set("x-user-id", String(payload.userId));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
