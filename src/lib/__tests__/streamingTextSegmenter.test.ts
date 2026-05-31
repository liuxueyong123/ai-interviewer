import { describe, expect, test } from "vitest";
import { createStreamingTextSegmenter } from "@/lib/streamingTextSegmenter";

describe("createStreamingTextSegmenter", () => {
  test("强标点达到最小长度后输出片段", () => {
    const segmenter = createStreamingTextSegmenter({ minChars: 6, targetChars: 12, maxChars: 20 });

    expect(segmenter.push("请介绍一下自己。")).toEqual(["请介绍一下自己。"]);
    expect(segmenter.flush()).toEqual([]);
  });

  test("过短的弱标点片段不立即输出", () => {
    const segmenter = createStreamingTextSegmenter({ minChars: 6, targetChars: 12, maxChars: 20 });

    expect(segmenter.push("你好，")).toEqual([]);
    expect(segmenter.push("请介绍一下项目。")).toEqual(["你好，请介绍一下项目。"]);
  });

  test("弱标点达到目标长度后输出片段", () => {
    const segmenter = createStreamingTextSegmenter({ minChars: 6, targetChars: 12, maxChars: 30 });

    expect(segmenter.push("我们先从你的项目经历开始，")).toEqual(["我们先从你的项目经历开始，"]);
  });

  test("无标点长文本达到最大长度后强制切分", () => {
    const segmenter = createStreamingTextSegmenter({ minChars: 6, targetChars: 12, maxChars: 10 });

    expect(segmenter.push("abcdefghijklmnopqrstuvwxyz")).toEqual(["abcdefghij", "klmnopqrst"]);
    expect(segmenter.flush()).toEqual(["uvwxyz"]);
  });

  test("flush 输出最后的短尾句", () => {
    const segmenter = createStreamingTextSegmenter({ minChars: 6, targetChars: 12, maxChars: 30 });

    expect(segmenter.push("最后")).toEqual([]);
    expect(segmenter.flush()).toEqual(["最后"]);
  });

  test("标点在后续 chunk 到达时也能输出完整片段", () => {
    const segmenter = createStreamingTextSegmenter({ minChars: 6, targetChars: 12, maxChars: 30 });

    expect(segmenter.push("请说说你最熟悉的技术")).toEqual([]);
    expect(segmenter.push("。")).toEqual(["请说说你最熟悉的技术。"]);
  });

  test("空白输入不产生片段", () => {
    const segmenter = createStreamingTextSegmenter();

    expect(segmenter.push("   \n\t")).toEqual([]);
    expect(segmenter.flush()).toEqual([]);
  });
});
