import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { EvaluationText } from "../EvaluationText";

describe("EvaluationText", () => {
  test("需要时显示简历建议", () => {
    render(
      <EvaluationText
        strengths="表达清晰"
        weaknesses="深度不足"
        resumeSuggestions="突出 React 项目指标"
        showResumeSuggestions={true}
      />
    );

    expect(screen.getByText("简历优化建议")).toBeTruthy();
    expect(screen.getByText("突出 React 项目指标")).toBeTruthy();
  });

  test("无简历面试时隐藏简历建议", () => {
    render(
      <EvaluationText
        strengths="表达清晰"
        weaknesses="深度不足"
        resumeSuggestions="不会展示"
        showResumeSuggestions={false}
      />
    );

    expect(screen.queryByText("简历优化建议")).toBeNull();
    expect(screen.queryByText("不会展示")).toBeNull();
  });
});
