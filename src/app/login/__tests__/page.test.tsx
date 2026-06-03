import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import LoginPage from "../page";

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

describe("LoginPage anonymous login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  test("creates an anonymous session and redirects to dashboard", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: { id: 1, username: "user12345", email: "user12345@anonymous.local" } }),
    } as Response);

    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "一键体验" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/auth/anonymous", { method: "POST" });
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  test("shows backend error when anonymous login fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "创建匿名账号失败，请重试" }),
    } as Response);

    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "一键体验" }));

    expect(await screen.findByText("创建匿名账号失败，请重试")).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
