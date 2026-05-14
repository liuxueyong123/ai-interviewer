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
          colorBgContainer: "#151b30",
          colorBgElevated: "#1e2640",
          colorBorder: "#3a4570",
          colorBorderSecondary: "#252d48",
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
