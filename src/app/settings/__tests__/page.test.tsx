import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import SettingsPage from "../page";

describe("SettingsPage password form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/users/me") {
        return {
          ok: true,
          json: async () => ({ username: "user12345", email: "user12345@anonymous.local" }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ success: true }),
      } as Response;
    });
  });

  test("sends only newPassword when setting password", async () => {
    render(<SettingsPage />);

    fireEvent.change(screen.getByPlaceholderText("至少8位，含两种字符类型"), { target: { value: "StrongPass1" } });
    fireEvent.click(screen.getByRole("button", { name: "设置新密码" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: "StrongPass1" }),
      });
    });
  });

  test("does not render current password input", () => {
    render(<SettingsPage />);

    expect(screen.queryByPlaceholderText("输入当前密码")).toBeNull();
  });

  test("blocks weak password before calling password api", async () => {
    render(<SettingsPage />);

    fireEvent.change(screen.getByPlaceholderText("至少8位，含两种字符类型"), { target: { value: "12345678" } });
    fireEvent.click(screen.getByRole("button", { name: "设置新密码" }));

    await waitFor(() => {
      expect(screen.getAllByText("密码需包含数字、小写字母、大写字母、符号中的至少两种").length).toBeGreaterThan(0);
    });
    expect(fetch).not.toHaveBeenCalledWith("/api/auth/password", expect.anything());
  });
});
