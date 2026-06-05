import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const interviewRepo = {
    findOne: vi.fn(),
    update: vi.fn(),
  };
  const evaluationRepo = {
    delete: vi.fn(),
    create: vi.fn((data: unknown) => data),
    save: vi.fn(async (evaluation: unknown) => evaluation),
  };
  return {
    getUserId: vi.fn(),
    getRepository: vi.fn((entity: { name?: string }) => {
      if (entity.name === "Interview") return interviewRepo;
      if (entity.name === "Evaluation") return evaluationRepo;
      if (entity.name === "Message") return {};
      throw new Error(`Unexpected repository: ${entity.name}`);
    }),
    interviewRepo,
    evaluationRepo,
    loggerError: vi.fn(),
    buildSingleQuestionEvaluationMessage: vi.fn(() => ({})),
    buildAggregationMessage: vi.fn(() => ({})),
    getEvaluation: vi.fn(),
    buildRoundSummaryMessage: vi.fn(() => ({})),
    getRoundSummary: vi.fn(),
    getPassThreshold: vi.fn(),
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

vi.mock("@/entities/Evaluation", () => ({
  Evaluation: class Evaluation {},
}));

vi.mock("@/entities/Message", () => ({
  Message: class Message {},
}));

vi.mock("@/lib/deepseek", () => ({
  buildSingleQuestionEvaluationMessage: mocks.buildSingleQuestionEvaluationMessage,
  buildAggregationMessage: mocks.buildAggregationMessage,
  getEvaluation: mocks.getEvaluation,
  buildRoundSummaryMessage: mocks.buildRoundSummaryMessage,
  getRoundSummary: mocks.getRoundSummary,
  getPassThreshold: mocks.getPassThreshold,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

function request() {
  return {
    headers: new Headers(),
  } as never;
}

describe("POST /api/interviews/[id]/finish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserId.mockReturnValue(9);
    mocks.interviewRepo.findOne.mockResolvedValue({
      id: 123,
      user: { id: 9 },
      position: "前端开发工程师",
      status: "ongoing",
      currentRound: 1,
      maxRounds: 1,
      difficulty: "mid",
      resumeText: "",
      messages: [
        { id: 1, role: "interviewer", content: "介绍自己", round: 1, questionNumber: 1 },
        { id: 2, role: "user", content: "我是前端工程师", round: 1, questionNumber: null },
      ],
    });
    mocks.interviewRepo.update.mockResolvedValue({ affected: 1 });
    mocks.evaluationRepo.delete.mockResolvedValue({ affected: 0 });
    mocks.evaluationRepo.create.mockImplementation((data: unknown) => data);
    mocks.evaluationRepo.save.mockImplementation(async (evaluation: unknown) => evaluation);
    mocks.getEvaluation
      .mockResolvedValueOnce(JSON.stringify({ score: 80, comment: "表达清晰" }))
      .mockResolvedValueOnce(JSON.stringify({
        overallScore: 80,
        categories: { tech: 80, project: 75, softSkills: 85 },
        strengths: "表达清晰",
        weaknesses: "深度不足",
        practiceSuggestions: [],
      }));
    mocks.getRoundSummary.mockResolvedValue("本轮总结");
    mocks.getPassThreshold.mockReturnValue(60);
  });

  test("聚合结果省略 resumeSuggestions 时存储空字符串", async () => {
    const { POST } = await import("../route");

    const response = await POST(request(), { params: Promise.resolve({ id: "123" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "evaluating" });

    await vi.waitFor(() => {
      expect(mocks.evaluationRepo.save).toHaveBeenCalled();
    });
    expect(mocks.evaluationRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      resumeSuggestions: "",
      strengths: "表达清晰",
      weaknesses: "深度不足",
    }));
  });
});
