import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { proxy, publicPaths } from "../proxy";

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  verifyToken: mocks.verifyToken,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: mocks.warn,
    info: mocks.info,
  },
  requestDuration: vi.fn(() => ({ durationMs: 1 })),
}));

function request(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

describe("proxy auth gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyToken.mockReturnValue(null);
  });

  test("treats anonymous auth api as public", () => {
    expect(publicPaths).toContain("/api/auth/anonymous");

    const response = proxy(request("/api/auth/anonymous"));

    expect(response.status).toBe(200);
    expect(mocks.verifyToken).not.toHaveBeenCalled();
  });

  test("keeps protected api routes protected without token", async () => {
    const response = proxy(request("/api/resumes"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "未登录" });
    expect(mocks.warn).toHaveBeenCalledWith("Unauthenticated API request", { method: "GET", path: "/api/resumes" });
  });
});
