import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  findOne: vi.fn(),
  update: vi.fn(async () => ({ affected: 1 })),
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
  verifyPassword: vi.fn(),
}));

vi.mock("@/lib/utils", () => ({
  getUserId: mocks.getUserId,
}));

vi.mock("@/lib/database", () => ({
  getDataSource: vi.fn(async () => ({
    getRepository: vi.fn(() => ({
      findOne: mocks.findOne,
      update: mocks.update,
    })),
  })),
}));

vi.mock("@/entities/User", () => ({
  User: class User {},
}));

vi.mock("@/lib/auth", () => ({
  hashPassword: mocks.hashPassword,
  verifyPassword: mocks.verifyPassword,
}));

function request(body: unknown) {
  return {
    json: async () => body,
    headers: new Headers(),
  } as never;
}

describe("PATCH /api/auth/password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserId.mockReturnValue(7);
    mocks.findOne.mockResolvedValue({ id: 7, passwordHash: "old-hash" });
    mocks.update.mockImplementation(async () => ({ affected: 1 }));
    mocks.hashPassword.mockImplementation(async (password: string) => `hashed:${password}`);
  });

  test("rejects unauthenticated requests", async () => {
    mocks.getUserId.mockReturnValue(0);
    const { PATCH } = await import("../route");

    const response = await PATCH(request({ newPassword: "StrongPass1" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "未登录" });
  });

  test("rejects weak new passwords", async () => {
    const { PATCH } = await import("../route");

    const response = await PATCH(request({ newPassword: "123" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("新密码至少8位");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  test("updates the current user password without currentPassword", async () => {
    const user = { id: 7, passwordHash: "old-hash" };
    mocks.findOne.mockResolvedValue(user);
    const { PATCH } = await import("../route");

    const response = await PATCH(request({ newPassword: "StrongPass1" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mocks.findOne).toHaveBeenCalledWith({ where: { id: 7 } });
    expect(mocks.hashPassword).toHaveBeenCalledWith("StrongPass1");
    expect(mocks.update).toHaveBeenCalledWith(7, { passwordHash: "hashed:StrongPass1" });
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
  });

  test("returns 404 if the session user no longer exists", async () => {
    mocks.findOne.mockResolvedValue(null);
    const { PATCH } = await import("../route");

    const response = await PATCH(request({ newPassword: "StrongPass1" }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "用户不存在" });
  });
});
