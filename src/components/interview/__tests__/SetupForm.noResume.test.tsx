import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import SetupForm from "../SetupForm";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

type FetchCall = {
  input: RequestInfo | URL;
  init?: RequestInit;
};

function mockFetchWithResumes(resumes: Array<{ id: number; filename: string }>) {
  const calls: FetchCall[] = [];
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });

    if (String(input) === "/api/resumes") {
      return {
        ok: true,
        json: async () => resumes,
      } as Response;
    }

    if (String(input) === "/api/interviews") {
      return {
        ok: true,
        json: async () => ({ interviewId: 123, mode: "text" }),
      } as Response;
    }

    return {
      ok: false,
      json: async () => ({ error: "unexpected request" }),
    } as Response;
  });
  return calls;
}

async function chooseFrontendPosition() {
  const positionInput = screen.getByPlaceholderText("搜索岗位（例如：前端、产品经理、金融分析师...）");
  fireEvent.focus(positionInput);
  fireEvent.change(positionInput, { target: { value: "前端" } });
  fireEvent.click(await screen.findByRole("button", { name: "前端开发工程师" }));
}

function getInterviewPostBody(calls: FetchCall[]) {
  const postCall = calls.find((call) => String(call.input) === "/api/interviews");
  expect(postCall).toBeTruthy();
  return JSON.parse(String(postCall?.init?.body));
}

describe("SetupForm 无简历模式", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pushMock.mockReset();
  });

  test("多份简历时默认选中第一份保存的简历", async () => {
    const calls = mockFetchWithResumes([
      { id: 1, filename: "first.pdf" },
      { id: 2, filename: "second.pdf" },
    ]);

    render(<SetupForm />);

    expect(await screen.findByText("first.pdf")).toBeTruthy();
    await chooseFrontendPosition();
    fireEvent.click(screen.getByRole("button", { name: "开始面试" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/interview/chat?id=123");
    });
    expect(getInterviewPostBody(calls)).toMatchObject({
      position: "前端开发工程师",
      resumeId: 1,
      questionCount: 12,
      maxRounds: 2,
      difficulty: "mid",
      mode: "text",
    });
  });

  test("再次点击已选中的简历可清除简历选择", async () => {
    const calls = mockFetchWithResumes([{ id: 7, filename: "resume.pdf" }]);

    render(<SetupForm />);

    const resumeButton = await screen.findByRole("button", { name: /resume\.pdf/ });
    fireEvent.click(resumeButton);
    await chooseFrontendPosition();
    fireEvent.click(screen.getByRole("button", { name: "开始面试" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/interview/chat?id=123");
    });
    expect(getInterviewPostBody(calls)).not.toHaveProperty("resumeId");
  });

  test("无保存简历时允许开始面试", async () => {
    const calls = mockFetchWithResumes([]);

    render(<SetupForm />);

    expect(await screen.findByText("暂无保存的简历，可直接开始无简历面试")).toBeTruthy();
    await chooseFrontendPosition();
    const startButton = screen.getByRole("button", { name: "开始面试" });
    expect((startButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/interview/chat?id=123");
    });
    expect(getInterviewPostBody(calls)).not.toHaveProperty("resumeId");
  });
});
