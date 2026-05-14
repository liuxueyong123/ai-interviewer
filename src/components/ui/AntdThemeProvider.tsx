"use client";

import { ConfigProvider, theme } from "antd";

export function AntdThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#8b5cf6",
          colorPrimaryHover: "#7c3aed",
          colorPrimaryActive: "#6d28d9",
          borderRadius: 10,
          colorBgContainer: "rgba(255, 255, 255, 0.05)",
          colorBgElevated: "rgba(255, 255, 255, 0.09)",
          colorBorder: "rgba(255, 255, 255, 0.14)",
          colorBorderSecondary: "rgba(255, 255, 255, 0.08)",
          colorText: "#f1f5f9",
          colorTextSecondary: "#94a3b8",
          colorTextPlaceholder: "#64748b",
          colorTextQuaternary: "#64748b",
          controlItemBgHover: "rgba(139, 92, 246, 0.12)",
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
