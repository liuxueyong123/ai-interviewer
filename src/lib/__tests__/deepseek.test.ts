import { describe, test, expect } from "vitest";
import {
  buildSingleQuestionEvaluationMessage,
  buildAggregationMessage,
  buildInterviewSystemMessage,
  buildRoundSummaryMessage,
} from "@/lib/deepseek";

describe("buildSingleQuestionEvaluationMessage", () => {
  test("includes question, answer and position", () => {
    const msg = buildSingleQuestionEvaluationMessage(
      "请介绍一下你的项目经验",
      "我做过一个电商项目，负责后端开发",
      "前端工程师"
    );

    expect(msg.getType()).toBe("human");
    const content = msg.content as string;
    expect(content).toContain("前端工程师");
    expect(content).toContain("请介绍一下你的项目经验");
    expect(content).toContain("我做过一个电商项目，负责后端开发");
  });

  test("does not include resume content", () => {
    const msg = buildSingleQuestionEvaluationMessage(
      "说说你的技术栈",
      "熟悉 React 和 Node.js",
      "高级前端"
    );

    const content = msg.content as string;
    expect(content).not.toContain("简历");
    expect(content).not.toContain("resume");
  });

  test("uses markdown headers for sections", () => {
    const msg = buildSingleQuestionEvaluationMessage("Q", "A", "前端");

    const content = msg.content as string;
    expect(content).toContain("## 评分维度");
    expect(content).toContain("## 面试官提问");
    expect(content).toContain("## 候选人回答");
  });

  test("separates sections with --- divider", () => {
    const msg = buildSingleQuestionEvaluationMessage("Q", "A", "前端");

    const content = msg.content as string;
    expect(content).toContain("---");
  });

  test("asks for score and comment in JSON output", () => {
    const msg = buildSingleQuestionEvaluationMessage("Q", "A", "前端");

    const content = msg.content as string;
    expect(content).toContain("score");
    expect(content).toContain("comment");
    expect(content).toContain("不要 markdown");
  });
});

describe("buildAggregationMessage", () => {
  const questionReviews = [
    { questionNumber: 1, question: "介绍自己", answer: "我叫张三，3年前端", score: 80, comment: "表达清晰" },
    { questionNumber: 2, question: "闭包是什么", answer: "闭包是函数内部可访问外部变量", score: 70, comment: "基本正确" },
  ];
  const resumeText = "3年React经验，做过电商项目";

  test("uses markdown headers for each Q&A pair", () => {
    const msg = buildAggregationMessage(questionReviews, resumeText);

    const content = msg.content as string;
    expect(content).toContain("### Q1");
    expect(content).toContain("### Q2");
  });

  test("has section headers for notes, conversation, and resume", () => {
    const msg = buildAggregationMessage(questionReviews, resumeText);

    const content = msg.content as string;
    expect(content).toContain("## 注意事项");
    expect(content).toContain("## 面试对话记录（含逐题评分）");
    expect(content).toContain("## 候选人简历");
  });

  test("embeds scores with bold label inside each Q&A", () => {
    const msg = buildAggregationMessage(questionReviews, resumeText);

    const content = msg.content as string;
    expect(content).toContain("**评分**：80分 | 表达清晰");
    expect(content).toContain("**评分**：70分 | 基本正确");
  });

  test("uses bold labels for interviewer and candidate", () => {
    const msg = buildAggregationMessage(questionReviews, resumeText);

    const content = msg.content as string;
    expect(content).toContain("**面试官**：介绍自己");
    expect(content).toContain("**候选人**：我叫张三，3年前端");
  });

  test("uses --- divider between Q&A pairs", () => {
    const msg = buildAggregationMessage(questionReviews, resumeText);

    const content = msg.content as string;
    expect(content).toContain("\n\n---\n\n");
  });

  test("omits score line when comment is failed", () => {
    const reviewsWithMissing = [
      { questionNumber: 1, question: "介绍自己", answer: "你好", score: 0, comment: "评分失败" },
      { questionNumber: 2, question: "闭包是什么", answer: "不知道", score: 60, comment: "勉强及格" },
    ];
    const msg = buildAggregationMessage(reviewsWithMissing, resumeText);

    const content = msg.content as string;
    expect(content).not.toContain("**评分**：0分 | 评分失败");
    expect(content).toContain("**评分**：60分 | 勉强及格");
  });

  test("does NOT include a separate JSON block for question reviews", () => {
    const msg = buildAggregationMessage(questionReviews, resumeText);

    const content = msg.content as string;
    expect(content).not.toContain('"questionNumber"');
    expect(content).not.toContain("逐题评分结果");
  });

  test("includes resume text", () => {
    const msg = buildAggregationMessage(questionReviews, resumeText);

    const content = msg.content as string;
    expect(content).toContain("3年React经验，做过电商项目");
  });

  test("asks for holistic evaluation in output schema", () => {
    const msg = buildAggregationMessage(questionReviews, resumeText);

    const content = msg.content as string;
    expect(content).toContain("overallScore");
    expect(content).toContain("categories");
    expect(content).toContain("strengths");
    expect(content).toContain("weaknesses");
    expect(content).toContain("practiceSuggestions");
  });
});

describe("buildInterviewSystemMessage", () => {
  test("includes position, resume, and rules in system prompt", () => {
    const msg = buildInterviewSystemMessage(
      "前端工程师",
      "3年React经验",
      12,
      "mid",
      1,
      1
    );

    expect(msg.getType()).toBe("system");
    const content = msg.content as string;
    expect(content).toContain("前端工程师");
    expect(content).toContain("3年React经验");
    expect(content).toContain("每次只提一个问题");
  });

  test("includes difficulty hint for junior level", () => {
    const msg = buildInterviewSystemMessage(
      "初级前端",
      "应届生",
      8,
      "junior",
      1,
      1
    );

    const content = msg.content as string;
    expect(content).toContain("基础概念");
  });

  test("includes round info for multi-round interviews", () => {
    const msg = buildInterviewSystemMessage(
      "高级后端",
      "5年Java",
      20,
      "senior",
      2,
      3
    );

    const content = msg.content as string;
    expect(content).toContain("第 2/3 轮");
  });
});

describe("buildAggregationMessage no-resume", () => {
  const questionReviews = [
    { questionNumber: 1, question: "介绍自己", answer: "我叫张三，3年前端", score: 80, comment: "表达清晰" },
    { questionNumber: 2, question: "闭包是什么", answer: "闭包是函数内部可访问外部变量", score: 70, comment: "基本正确" },
  ];

  test("无简历聚合输出 schema 中省略简历建议", () => {
    const msg = buildAggregationMessage(questionReviews, "");

    const content = msg.content as string;
    expect(content).not.toContain("resumeSuggestions");
    expect(content).not.toContain("## 候选人简历");
    expect(content).toContain("候选人未提供简历");
    expect(content).toContain("practiceSuggestions");
  });

  test("有简历聚合保留简历建议", () => {
    const msg = buildAggregationMessage(questionReviews, "3年React经验，做过电商项目");

    const content = msg.content as string;
    expect(content).toContain("resumeSuggestions");
    expect(content).toContain("## 候选人简历");
  });
});

describe("buildInterviewSystemMessage no-resume", () => {
  test("简历文本为空时使用无简历提示词", () => {
    const msg = buildInterviewSystemMessage(
      "前端工程师",
      "",
      12,
      "mid",
      1,
      1
    );

    const content = msg.content as string;
    expect(content).toContain("候选人没有提供简历");
    expect(content).toContain("通过候选人的自我介绍和后续回答建立背景");
    expect(content).toContain("岗位基础");
    expect(content).not.toContain("## 候选人简历");
    expect(content).not.toContain("## 候选人简历");
  });

  test("简历文本存在时保留简历章节", () => {
    const msg = buildInterviewSystemMessage(
      "前端工程师",
      "3年React经验",
      12,
      "mid",
      1,
      1
    );

    const content = msg.content as string;
    expect(content).toContain("## 候选人简历");
    expect(content).toContain("3年React经验");
  });
});

describe("buildRoundSummaryMessage", () => {
  test("uses markdown headers for sections", () => {
    const msg = buildRoundSummaryMessage(
      "Q1 面试官：介绍自己\n候选人：我叫张三"
    );

    expect(msg.getType()).toBe("human");
    const content = msg.content as string;
    expect(content).toContain("## 总结要求");
    expect(content).toContain("## 对话记录");
  });

  test("separates sections with --- divider", () => {
    const msg = buildRoundSummaryMessage("Q1 面试官：介绍自己\n候选人：我叫张三");

    const content = msg.content as string;
    expect(content).toContain("---");
  });

  test("includes conversation content", () => {
    const msg = buildRoundSummaryMessage("**面试官**（Q1）：介绍自己\n\n---\n\n**候选人**：我叫张三");

    const content = msg.content as string;
    expect(content).toContain("**面试官**");
    expect(content).toContain("**候选人**");
  });
});
