import { beforeEach, describe, expect, test, vi } from "vitest";

type MockUser = {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
};

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  create: vi.fn((data: Omit<MockUser, "id">) => ({ id: 42, ...data })),
  save: vi.fn(async (user: MockUser) => user),
  loggerError: vi.fn(),
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
  signToken: vi.fn((userId: number) => `token-for-${userId}`),
}));

vi.mock("@/lib/database", () => ({
  getDataSource: vi.fn(async () => ({
    getRepository: vi.fn(() => ({
      findOne: mocks.findOne,
      create: mocks.create,
      save: mocks.save,
    })),
  })),
}));

vi.mock("@/entities/User", () => ({
  User: class User {},
}));

vi.mock("@/lib/auth", () => ({
  hashPassword: mocks.hashPassword,
  signToken: mocks.signToken,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

function setRandomValues(values: number[]) {
  const random = vi.spyOn(Math, "random");
  for (const value of values) {
    random.mockReturnValueOnce(value);
  }
  random.mockReturnValue(0.12345);
  return random;
}

describe("POST /api/auth/anonymous", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    process.env.COOKIE_SECURE = "false";
    mocks.findOne.mockResolvedValue(null);
    mocks.create.mockImplementation((data: Omit<MockUser, "id">) => ({ id: 42, ...data }));
    mocks.save.mockImplementation(async (user: MockUser) => user);
    mocks.hashPassword.mockImplementation(async (password: string) => `hashed:${password}`);
    mocks.signToken.mockImplementation((userId: number) => `token-for-${userId}`);
  });

  test("creates a normal user with generated username and anonymous email", async () => {
    setRandomValues([0.48291]);
    const { POST } = await import("../route");

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      token: "token-for-42",
      user: {
        id: 42,
        username: "user48291",
        email: "user48291@anonymous.local",
      },
    });
    expect(mocks.create).toHaveBeenCalledWith({
      username: "user48291",
      email: "user48291@anonymous.local",
      passwordHash: expect.stringMatching(/^hashed:/),
    });
    expect(body.user).not.toHaveProperty("passwordHash");
    expect(body).not.toHaveProperty("password");
  });

  test("sets the same token cookie shape as login and register", async () => {
    setRandomValues([0.55555]);
    const { POST } = await import("../route");

    const response = await POST();
    const setCookie = response.headers.get("set-cookie");

    expect(setCookie).toContain("token=token-for-42");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Max-Age=604800");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=lax");
  });

  test("retries when the generated identity already exists", async () => {
    setRandomValues([0.11111, 0.22222]);
    mocks.findOne.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce(null);
    const { POST } = await import("../route");

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.user.username).toBe("user22222");
    expect(mocks.findOne).toHaveBeenCalledTimes(2);
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });

  test("retries when save fails with a duplicate key error", async () => {
    setRandomValues([0.33333, 0.44444]);
    mocks.save
      .mockRejectedValueOnce(Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY", errno: 1062 }))
      .mockImplementationOnce(async (user: MockUser) => user);
    const { POST } = await import("../route");

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.user.username).toBe("user44444");
    expect(mocks.save).toHaveBeenCalledTimes(2);
  });

  test("returns a generic anonymous creation error after retry exhaustion", async () => {
    setRandomValues([0.10000, 0.10001, 0.10002, 0.10003, 0.10004, 0.10005, 0.10006, 0.10007]);
    mocks.findOne.mockResolvedValue({ id: 1 });
    const { POST } = await import("../route");

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "创建匿名账号失败，请重试" });
    expect(mocks.save).not.toHaveBeenCalled();
  });

  test("returns a generic server error for unexpected failures", async () => {
    setRandomValues([0.77777]);
    mocks.save.mockRejectedValueOnce(new Error("database offline"));
    const { POST } = await import("../route");

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "服务器错误，请稍后重试" });
    expect(mocks.loggerError).toHaveBeenCalledWith("Anonymous login error", { error: "Error: database offline" });
  });
});
