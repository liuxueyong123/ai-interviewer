import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ResultsPage from "../page";

const pushMock = vi.fn();
const fetchDataMock = vi.fn();
const handleRetryMock = vi.fn();

const pollingMock = vi.hoisted(() => ({
  useResultsPolling: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "123" }),
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/hooks/useResultsPolling", () => ({
  useResultsPolling: pollingMock.useResultsPolling,
}));

vi.mock("@/components/interview/InterviewReview", () => ({
  InterviewReview: () => <div data-testid="interview-review" />,
}));

function resultData(resumeText: string) {
  return {
    interview: {
      id: 123,
      title: "面试1: 前端开发工程师",
      position: "前端开发工程师",
      status: "done",
      resumeText,
      questionCount: 12,
      difficulty: "mid",
      currentRound: 1,
      maxRounds: 1,
      mode: "text",
      createdAt: "2026-06-05T00:00:00.000Z",
    },
    messages: [
      { id: 1, role: "interviewer", content: "介绍自己", round: 1, questionNumber: 1, createdAt: "2026-06-05T00:00:00.000Z" },
      { id: 2, role: "user", content: "我是前端工程师", round: 1, questionNumber: null, createdAt: "2026-06-05T00:00:00.000Z" },
    ],
    evaluations: [
      {
        round: 1,
        overallScore: 80,
        categories: { tech: 80, project: 75, softSkills: 85 },
        strengths: "表达清晰",
        weaknesses: "深度不足",
        resumeSuggestions: "突出项目指标",
        questionReviews: [],
        practiceSuggestions: null,
        roundSummary: null,
      },
    ],
  };
}

describe("ResultsPage 无简历渲染", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pollingMock.useResultsPolling.mockReturnValue({
      data: resultData(""),
      error: "",
      timedOut: false,
      fetchData: fetchDataMock,
      handleRetry: handleRetryMock,
    });
  });

  test("面试 resumeText 为空时隐藏简历建议", () => {
    render(<ResultsPage />);

    expect(screen.queryByText("简历优化建议")).toBeNull();
    expect(screen.queryByText("突出项目指标")).toBeNull();
    expect(screen.getByText("表达清晰")).toBeTruthy();
    expect(screen.getByText("深度不足")).toBeTruthy();
  });

  test("面试有 resumeText 时显示简历建议", () => {
    pollingMock.useResultsPolling.mockReturnValue({
      data: resultData("3年React经验"),
      error: "",
      timedOut: false,
      fetchData: fetchDataMock,
      handleRetry: handleRetryMock,
    });

    render(<ResultsPage />);

    expect(screen.getByText("简历优化建议")).toBeTruthy();
    expect(screen.getByText("突出项目指标")).toBeTruthy();
  });
});
