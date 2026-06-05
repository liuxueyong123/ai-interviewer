import { beforeEach, describe, expect, test, vi } from "vitest";

type MockInterview = {
  id: number;
  user: { id: number };
  position: string;
  title: string;
  resumeText: string;
  status: string;
  questionCount: number;
  difficulty: string;
  currentRound: number;
  maxRounds: number;
  mode: string;
};

const mocks = vi.hoisted(() => {
  const interviewRepo = {
    find: vi.fn(),
    findOne: vi.fn(),
    count: vi.fn(),
    create: vi.fn((data: Omit<MockInterview, "id">) => ({ id: 101, ...data })),
    save: vi.fn(async (interview: MockInterview) => interview),
  };
  const resumeRepo = {
    findOne: vi.fn(),
  };
  const messageRepo = {
    create: vi.fn((data: unknown) => data),
    save: vi.fn(async (message: unknown) => message),
  };
  return {
    getUserId: vi.fn(),
    getRepository: vi.fn((entity: { name?: string }) => {
      if (entity.name === "Interview") return interviewRepo;
      if (entity.name === "Resume") return resumeRepo;
      if (entity.name === "Message") return messageRepo;
      throw new Error(`Unexpected repository: ${entity.name}`);
    }),
    interviewRepo,
    resumeRepo,
    messageRepo,
  };
});

vi.mock("@/lib/utils", () => ({
  getUserId: mocks.getUserId,
}));

vi.mock("@/lib/database", () => ({
  getDataSource: vi.fn(async () => ({
    getRepository: mocks.getRepository,
  })),
}));

vi.mock("@/entities/Interview", () => ({
  Interview: class Interview {},
}));

vi.mock("@/entities/Resume", () => ({
  Resume: class Resume {},
}));

vi.mock("@/entities/Message", () => ({
  Message: class Message {},
}));

function request(body: unknown) {
  return {
    json: async () => body,
  } as never;
}

describe("POST /api/interviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserId.mockReturnValue(9);
    mocks.interviewRepo.count.mockResolvedValue(0);
    mocks.interviewRepo.create.mockImplementation((data: Omit<MockInterview, "id">) => ({ id: 101, ...data }));
    mocks.interviewRepo.save.mockImplementation(async (interview: MockInterview) => interview);
    mocks.resumeRepo.findOne.mockResolvedValue(null);
    mocks.messageRepo.create.mockImplementation((data: unknown) => data);
    mocks.messageRepo.save.mockImplementation(async (message: unknown) => message);
  });

  test("省略 resumeId 时创建无简历面试", async () => {
    const { POST } = await import("../route");

    const response = await POST(request({
      position: "前端开发工程师",
      questionCount: 12,
      maxRounds: 2,
      difficulty: "mid",
      mode: "text",
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ interviewId: 101, mode: "text" });
    expect(mocks.resumeRepo.findOne).not.toHaveBeenCalled();
    expect(mocks.interviewRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      user: { id: 9 },
      position: "前端开发工程师",
      resumeText: "",
      status: "ongoing",
      questionCount: 12,
      difficulty: "mid",
      currentRound: 1,
      maxRounds: 2,
      mode: "text",
    }));
    expect(mocks.messageRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining("岗位能力、项目经历和综合素质"),
      round: 1,
      questionNumber: 1,
    }));
  });

  test("有 resumeId 时保持基于简历的创建", async () => {
    mocks.resumeRepo.findOne.mockResolvedValue({ id: 5, content: "3年React经验" });
    const { POST } = await import("../route");

    const response = await POST(request({
      position: "前端开发工程师",
      resumeId: 5,
      questionCount: 12,
      maxRounds: 2,
      difficulty: "mid",
      mode: "voice",
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ interviewId: 101, mode: "voice" });
    expect(mocks.resumeRepo.findOne).toHaveBeenCalledWith({
      where: { id: 5, user: { id: 9 } },
    });
    expect(mocks.interviewRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      resumeText: "3年React经验",
      mode: "voice",
    }));
  });

  test("拒绝无效或未授权的 resumeId", async () => {
    mocks.resumeRepo.findOne.mockResolvedValue(null);
    const { POST } = await import("../route");

    const response = await POST(request({
      position: "前端开发工程师",
      resumeId: 99,
    }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "简历不存在" });
    expect(mocks.interviewRepo.save).not.toHaveBeenCalled();
    expect(mocks.messageRepo.save).not.toHaveBeenCalled();
  });
});
