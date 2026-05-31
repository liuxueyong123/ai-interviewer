# 流式 TTS 降低语音面试等待时间实施计划

> **给自动化执行者：** 执行本计划时必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，逐任务勾选复选框。

**目标：** 在 DeepSeek 流式输出过程中就开始切句、合成和播放语音；TTS 片段失败后自动重试；当前片段播放时预合成后续片段；字幕只展示已合成完成的片段，并在等待首段时显示动效。

**架构：** 新增纯函数式流式文本分句器；将 `useTTS` 改成带重试、预合成、顺序播放和片段回调的队列；改造 `VoiceInterview`，让它边读 `/api/chat` SSE chunk，边把可播放片段送入 TTS 队列。第一阶段保持 `/api/chat` 和 `/api/tts` API 协议不变。

**技术栈：** Next.js 16 App Router、React 19、TypeScript、Vitest、eventsource-parser、现有 `/api/chat` SSE、现有 `/api/tts`

---

## 文件结构

```text
新增：
  src/lib/streamingTextSegmenter.ts
  src/lib/__tests__/streamingTextSegmenter.test.ts
  src/hooks/__tests__/useTTS.test.ts

修改：
  src/hooks/useTTS.ts
  src/components/interview/VoiceInterview.tsx
```

---

## 任务 1：新增流式文本分句器

**文件：**

- 新增：`src/lib/streamingTextSegmenter.ts`
- 测试：`src/lib/__tests__/streamingTextSegmenter.test.ts`

- [ ] **步骤 1：先写失败测试**

创建 `src/lib/__tests__/streamingTextSegmenter.test.ts`：

```typescript
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
```

- [ ] **步骤 2：运行测试确认 RED**

```bash
pnpm test src/lib/__tests__/streamingTextSegmenter.test.ts
```

预期：测试失败，原因是 `@/lib/streamingTextSegmenter` 尚不存在。

- [ ] **步骤 3：实现分句器**

创建 `src/lib/streamingTextSegmenter.ts`：

```typescript
export interface SegmentPolicy {
  minChars: number;
  targetChars: number;
  maxChars: number;
  hardPunctuation: RegExp;
  softPunctuation: RegExp;
}

export interface StreamingTextSegmenter {
  push: (chunk: string) => string[];
  flush: () => string[];
}

export const DEFAULT_SEGMENT_POLICY: SegmentPolicy = {
  minChars: 10,
  targetChars: 28,
  maxChars: 48,
  hardPunctuation: /[。！？!?；;\n]/,
  softPunctuation: /[，,、：:]/,
};

function hasMatch(pattern: RegExp, value: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(value);
}

function findBoundary(buffer: string, policy: SegmentPolicy): number {
  let softBoundary = -1;

  for (let i = 0; i < buffer.length; i += 1) {
    const char = buffer[i];
    const end = i + 1;

    if (hasMatch(policy.hardPunctuation, char) && end >= policy.minChars) return end;
    if (hasMatch(policy.softPunctuation, char) && end >= policy.targetChars) softBoundary = end;
  }

  if (softBoundary >= policy.targetChars) return softBoundary;
  if (buffer.length >= policy.maxChars) return policy.maxChars;
  return -1;
}

export function createStreamingTextSegmenter(overrides: Partial<SegmentPolicy> = {}): StreamingTextSegmenter {
  const policy = { ...DEFAULT_SEGMENT_POLICY, ...overrides };
  let buffer = "";

  function drain(): string[] {
    const segments: string[] = [];

    while (buffer.trim().length > 0) {
      const boundary = findBoundary(buffer, policy);
      if (boundary < 0) break;

      const segment = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary).trimStart();
      if (segment.length > 0) segments.push(segment);
    }

    return segments;
  }

  return {
    push(chunk: string) {
      if (chunk.trim().length === 0) return [];
      buffer += chunk;
      return drain();
    },
    flush() {
      const drained = drain();
      const tail = buffer.trim();
      buffer = "";
      return tail.length > 0 ? [...drained, tail] : drained;
    },
  };
}
```

- [ ] **步骤 4：运行测试确认 GREEN**

```bash
pnpm test src/lib/__tests__/streamingTextSegmenter.test.ts
```

预期：全部通过。

- [ ] **步骤 5：提交**

```bash
git add src/lib/streamingTextSegmenter.ts src/lib/__tests__/streamingTextSegmenter.test.ts
git commit -m "feat: add streaming text segmenter"
```

---

## 任务 2：将 useTTS 改造成支持重试和预合成的有序队列

**文件：**

- 修改：`src/hooks/useTTS.ts`
- 测试：`src/hooks/__tests__/useTTS.test.ts`

- [ ] **步骤 1：先写 Hook 测试**

创建 `src/hooks/__tests__/useTTS.test.ts`：

```typescript
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useTTS } from "@/hooks/useTTS";

type AudioInstance = {
  src: string;
  onplay: (() => void) | null;
  onended: (() => void) | null;
  onerror: (() => void) | null;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  currentTime: number;
  playbackRate: number;
};

const audioInstances: AudioInstance[] = [];

beforeEach(() => {
  audioInstances.length = 0;
  vi.useFakeTimers();

  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ audio: `data:audio/wav;base64,${audioInstances.length}` }),
  })) as unknown as typeof fetch;

  vi.stubGlobal(
    "Audio",
    vi.fn((src: string) => {
      const instance: AudioInstance = {
        src,
        onplay: null,
        onended: null,
        onerror: null,
        play: vi.fn(async () => {
          instance.onplay?.();
        }),
        pause: vi.fn(),
        currentTime: 0,
        playbackRate: 1,
      };
      audioInstances.push(instance);
      return instance;
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useTTS queue", () => {
  test("入队一个片段后请求 TTS 并播放音频", async () => {
    const { result } = renderHook(() => useTTS());

    await act(async () => {
      result.current.enqueue("第一段。");
      await Promise.resolve();
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/tts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ text: "第一段。" }),
      }),
    );
    expect(audioInstances[0].play).toHaveBeenCalled();
    expect(result.current.state).toBe("playing");

    await act(async () => {
      audioInstances[0].onended?.();
      await result.current.waitForIdle();
    });

    expect(result.current.state).toBe("idle");
    expect(result.current.metrics.completedCount).toBe(1);
  });

  test("当前片段播放时会预合成后续片段，但不会乱序播放", async () => {
    const resolvers: Array<(value: { ok: true; json: () => Promise<{ audio: string }> }) => void> = [];
    global.fetch = vi.fn(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useTTS({ prefetchLimit: 3 }));

    act(() => {
      result.current.enqueue("第一段。");
      result.current.enqueue("第二段。");
    });

    expect(fetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolvers[1]({ ok: true, json: async () => ({ audio: "data:audio/wav;base64,second" }) });
      await Promise.resolve();
    });
    expect(audioInstances).toHaveLength(0);

    await act(async () => {
      resolvers[0]({ ok: true, json: async () => ({ audio: "data:audio/wav;base64,first" }) });
      await Promise.resolve();
    });
    expect(audioInstances[0].src).toBe("data:audio/wav;base64,first");
  });

  test("单个片段失败后先重试，成功后才播放", async () => {
    let call = 0;
    global.fetch = vi.fn(async () => {
      call += 1;
      if (call <= 2) return { ok: false, json: async () => ({ error: "failed" }) };
      return { ok: true, json: async () => ({ audio: "data:audio/wav;base64,ok" }) };
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useTTS({ maxRetries: 2 }));

    await act(async () => {
      result.current.enqueue("会重试的片段。");
      await vi.runAllTimersAsync();
    });

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result.current.metrics.retriedCount).toBe(2);
    expect(result.current.metrics.failedCount).toBe(0);
    expect(audioInstances[0].play).toHaveBeenCalled();
  });

  test("超过重试上限后触发错误回调并停止全部后续片段", async () => {
    const onSegmentError = vi.fn();
    let call = 0;
    global.fetch = vi.fn(async () => {
      call += 1;
      if (call <= 2) return { ok: false, json: async () => ({ error: "failed" }) };
      return { ok: true, json: async () => ({ audio: "data:audio/wav;base64,next" }) };
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useTTS({ maxRetries: 1, onSegmentError }));

    await act(async () => {
      result.current.enqueue("失败段。");
      result.current.enqueue("后续段。");
      await vi.runAllTimersAsync();
    });

    // 第一个片段失败后应触发错误回调
    expect(onSegmentError).toHaveBeenCalledWith("失败段。", expect.any(Error));
    expect(result.current.metrics.failedCount).toBe(1);
    // 后续段被取消，不应创建 Audio 实例
    // audioInstances 应有 0 个（第二个片段被停止而未创建 Audio）
    const playedCount = audioInstances.filter((a) => a.play.mock.calls.length > 0).length;
    expect(playedCount).toBe(0);
    // 队列状态应为 error
    expect(result.current.state).toBe("error");
  });

  test("onSegmentReady 按队列顺序触发，即使后续片段先合成完成", async () => {
    // 构造：第 2 段 TTS 先 resolve，第 1 段后 resolve
    const resolvers: Array<(value: { ok: true; json: () => Promise<{ audio: string }> }) => void> = [];
    let resolveCount = 0;
    global.fetch = vi.fn(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    ) as unknown as typeof fetch;

    const onSegmentReady = vi.fn();
    const { result } = renderHook(() => useTTS({ prefetchLimit: 3, onSegmentReady }));

    act(() => {
      result.current.enqueue("第一段。");
      result.current.enqueue("第二段。");
    });

    // 第 2 段先合成完成
    await act(async () => {
      resolvers[1]({ ok: true, json: async () => ({ audio: "data:audio/wav;base64,2" }) });
      await Promise.resolve();
    });
    // 第 1 段还没 ready，第 2 段不能触发字幕
    expect(onSegmentReady).not.toHaveBeenCalled();

    // 第 1 段合成完成
    await act(async () => {
      resolvers[0]({ ok: true, json: async () => ({ audio: "data:audio/wav;base64,1" }) });
      await Promise.resolve();
    });
    // 现在按顺序触发：先第 1 段，再第 2 段
    expect(onSegmentReady).toHaveBeenCalledTimes(2);
    expect(onSegmentReady).toHaveBeenNthCalledWith(1, "第一段。");
    expect(onSegmentReady).toHaveBeenNthCalledWith(2, "第二段。");
  });

  test("resetMetrics 清空本轮指标和快照", async () => {
    const { result } = renderHook(() => useTTS());

    await act(async () => {
      result.current.enqueue("第一段。");
      await Promise.resolve();
      audioInstances[0].onended?.();
      await result.current.waitForIdle();
    });

    expect(result.current.metrics.completedCount).toBe(1);
    expect(result.current.getMetricsSnapshot().completedCount).toBe(1);

    act(() => {
      result.current.resetMetrics();
    });

    const empty = {
      enqueuedCount: 0,
      retriedCount: 0,
      completedCount: 0,
      failedCount: 0,
      firstEnqueuedAt: null,
      firstAudioReadyAt: null,
      firstPlaybackStartedAt: null,
    };

    expect(result.current.metrics).toEqual(empty);
    expect(result.current.getMetricsSnapshot()).toEqual(empty);
  });

  test("空字符串入队不产生片段", () => {
    const { result } = renderHook(() => useTTS());

    act(() => {
      result.current.enqueue("");
      result.current.enqueue("   ");
    });

    expect(result.current.queueSize).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  test("stop 在合成中途取消 pending 请求", async () => {
    let aborted = false;
    global.fetch = vi.fn((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          aborted = true;
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useTTS());

    act(() => {
      result.current.enqueue("第一段。");
    });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.stop();
    });

    expect(aborted).toBe(true);
    expect(result.current.state).toBe("idle");
    expect(result.current.queueSize).toBe(0);
  });

  test("快速连续入队多个片段时保持顺序", async () => {
    const playOrder: string[] = [];
    vi.stubGlobal(
      "Audio",
      vi.fn((src: string) => ({
        src,
        onplay: null,
        onended: null,
        onerror: null,
        play: vi.fn(async function (this: AudioInstance) {
          this.onplay?.();
          // 延迟触发 onended 以确保顺序
          await new Promise((r) => setTimeout(r, 10));
          playOrder.push(src);
          this.onended?.();
        }),
        pause: vi.fn(),
        currentTime: 0,
        playbackRate: 1,
      })),
    );

    const { result } = renderHook(() => useTTS());

    await act(async () => {
      result.current.enqueue("1。");
      result.current.enqueue("2。");
      result.current.enqueue("3。");
      await vi.runAllTimersAsync();
      await result.current.waitForIdle();
    });

    expect(playOrder).toHaveLength(3);
    // 验证顺序
    expect(playOrder[0]).toContain("base64,0");
    expect(playOrder[1]).toContain("base64,1");
    expect(playOrder[2]).toContain("base64,2");
  });
});
```

- [ ] **步骤 2：运行测试确认 RED**

```bash
pnpm test src/hooks/__tests__/useTTS.test.ts
```

预期：测试失败，原因是当前 `useTTS` 仍暴露 `speak()`，还没有 `enqueue()`、重试、预合成和片段 ready 回调。

如果缺少 `@testing-library/react`，安装测试依赖：

```bash
pnpm add -D @testing-library/react
```

- [ ] **步骤 3：实现队列类型和公开接口**

将 `src/hooks/useTTS.ts` 的类型定义为：

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TTSQueueState = "idle" | "loading" | "playing" | "error";
type QueueItemStatus = "queued" | "loading" | "ready" | "playing" | "done" | "failed";

export interface TTSMetrics {
  enqueuedCount: number;
  retriedCount: number;
  completedCount: number;
  failedCount: number;
  firstEnqueuedAt: number | null;
  firstAudioReadyAt: number | null;
  firstPlaybackStartedAt: number | null;
}

export interface UseTTSOptions {
  maxRetries?: number;
  prefetchLimit?: number;
  onSegmentReady?: (text: string) => void;
  onSegmentStart?: (text: string) => void;
  onSegmentError?: (text: string, error: Error) => void;
}

interface QueueItem {
  id: number;
  text: string;
  status: QueueItemStatus;
  attempts: number;
  audio: string | null;
  error: string | null;
}

const emptyMetrics: TTSMetrics = {
  enqueuedCount: 0,
  retriedCount: 0,
  completedCount: 0,
  failedCount: 0,
  firstEnqueuedAt: null,
  firstAudioReadyAt: null,
  firstPlaybackStartedAt: null,
};

function now(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

- [ ] **步骤 4：实现 Hook 主体**

在 `useTTS` 内实现队列、重试、预合成和有序播放。重点是：合成可以并发预取，播放只能消费队首 ready 片段。

```typescript
export function useTTS(options: UseTTSOptions = {}) {
  const maxRetries = options.maxRetries ?? 2;
  const prefetchLimit = options.prefetchLimit ?? 3;

  const [state, setState] = useState<TTSQueueState>("idle");
  const [currentText, setCurrentText] = useState("");
  const [queueSize, setQueueSize] = useState(0);
  const [metrics, setMetrics] = useState<TTSMetrics>(emptyMetrics);

  const queueRef = useRef<QueueItem[]>([]);
  const playingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const controllersRef = useRef<Map<number, AbortController>>(new Map());
  const generationRef = useRef(0);
  const waitersRef = useRef<Array<() => void>>([]);
  const nextIdRef = useRef(1);
  const metricsRef = useRef<TTSMetrics>(emptyMetrics);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const updateMetrics = useCallback((updater: (prev: TTSMetrics) => TTSMetrics) => {
    const next = updater(metricsRef.current);
    metricsRef.current = next;
    setMetrics(next);
  }, []);

  const syncQueueSize = useCallback(() => {
    setQueueSize(queueRef.current.filter((item) => !["done", "failed"].includes(item.status)).length);
  }, []);

  const markItem = useCallback((id: number, patch: Partial<QueueItem>) => {
    queueRef.current = queueRef.current.map((item) => (
      item.id === id ? { ...item, ...patch } : item
    ));
    syncQueueSize();
  }, [syncQueueSize]);

  const resolveWaiters = useCallback(() => {
    const active = queueRef.current.some((item) => !["done", "failed"].includes(item.status));
    if (active || playingRef.current) return;
    const waiters = waitersRef.current;
    waitersRef.current = [];
    waiters.forEach((resolve) => resolve());
  }, []);
```

合成逻辑：

```typescript
async function synthesizeItem(itemId: number, generation: number) {
  const item = queueRef.current.find((candidate) => candidate.id === itemId);
  if (!item || item.status !== "queued" || generationRef.current !== generation) return;

  markItem(itemId, { status: "loading" });
  setState((prev) => (prev === "playing" ? prev : "loading"));

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const abort = new AbortController();
    controllersRef.current.set(itemId, abort);

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: item.text }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "TTS 请求失败");
      }

      const data = await res.json();
      if (!data.audio) throw new Error("TTS 响应缺少音频");

      controllersRef.current.delete(itemId);
      markItem(itemId, { status: "ready", audio: data.audio, attempts: attempt + 1 });
      updateMetrics((prev) => ({
        ...prev,
        firstAudioReadyAt: prev.firstAudioReadyAt ?? now(),
      }));
      // 不在此处直接触发 onSegmentReady——改为从队首扫描连续 ready 片段，
      // 确保即使后续片段先合成完成，字幕也严格按文本顺序展示。
      flushReadySubtitles();
      scheduleWork();
      return;
    } catch (error) {
      controllersRef.current.delete(itemId);
      if ((error as Error).name === "AbortError" || generationRef.current !== generation) return;

      if (attempt < maxRetries) {
        updateMetrics((prev) => ({ ...prev, retriedCount: prev.retriedCount + 1 }));
        await delay(attempt === 0 ? 300 : 800);
        continue;
      }

      markItem(itemId, { status: "failed", error: (error as Error).message, attempts: attempt + 1 });
      updateMetrics((prev) => ({ ...prev, failedCount: prev.failedCount + 1 }));

      // 单段失败后立即停止全部后续：清空队列、取消进行中的 fetch、丢弃已 ready 的音频
      generationRef.current += 1;
      const nextGen = generationRef.current;
      controllersRef.current.forEach((controller) => controller.abort());
      controllersRef.current.clear();
      // 标记所有未完成片段为 cancelled（除当前失败的）
      queueRef.current = queueRef.current.map((item) =>
        item.id === itemId
          ? item
          : ["done", "failed"].includes(item.status)
            ? item
            : { ...item, status: "failed", error: "cancelled" as unknown as string },
      );
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      playingRef.current = false;
      setState("error");
      syncQueueSize();

      // 通知消费者展示全文回退字幕
      optionsRef.current.onSegmentError?.(item.text, error as Error);
      resolveWaiters();
      return;
    }
  }
}
```

调度和播放逻辑：

```typescript
// 从队首扫描连续 ready 片段，按序触发 onSegmentReady。
// 保证即使第 2 段先于第 1 段合成完成，字幕也不会乱序。
function flushReadySubtitles() {
  const items = queueRef.current;
  // 跳过已经触发过字幕的片段（已 done/failed，或已标记 subtitled）
  let idx = 0;
  while (idx < items.length) {
    const item = items[idx];
    if (item.status === "done" || item.status === "failed") { idx += 1; continue; }
    if ((item as QueueItem & { subtitled?: boolean }).subtitled) { idx += 1; continue; }
    if (item.status !== "ready") break; // 遇到第一个未 ready 的片段就停止
    // 连续 ready，触发字幕
    (item as QueueItem & { subtitled?: boolean }).subtitled = true;
    optionsRef.current.onSegmentReady?.(item.text);
    idx += 1;
  }
}

function scheduleWork() {
  const generation = generationRef.current;
  const activeSynthesis = queueRef.current.filter((item) => item.status === "loading").length;
  const capacity = Math.max(1, prefetchLimit + 1) - activeSynthesis;
  const queuedItems = queueRef.current.filter((item) => item.status === "queued").slice(0, Math.max(0, capacity));

  queuedItems.forEach((item) => {
    void synthesizeItem(item.id, generation);
  });

  if (!playingRef.current) {
    void playNextReady(generation);
  }
}

async function playNextReady(generation: number) {
  if (playingRef.current || generationRef.current !== generation) return;

  const next = queueRef.current.find((item) => item.status !== "done" && item.status !== "failed");
  if (!next) {
    setState("idle");
    setCurrentText("");
    resolveWaiters();
    return;
  }

  if (next.status === "queued" || next.status === "loading") {
    setState("loading");
    return;
  }

  if (next.status !== "ready" || !next.audio) return;

  playingRef.current = true;
  markItem(next.id, { status: "playing" });
  setCurrentText(next.text);
  optionsRef.current.onSegmentStart?.(next.text);

  const audio = new Audio(next.audio);
  audioRef.current = audio;
  audio.playbackRate = 1.3;

  try {
    await new Promise<void>((resolve, reject) => {
      audio.onplay = () => {
        setState("playing");
        updateMetrics((prev) => ({
          ...prev,
          firstPlaybackStartedAt: prev.firstPlaybackStartedAt ?? now(),
        }));
      };
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("音频播放失败"));
      audio.play().catch(reject);
    });

    markItem(next.id, { status: "done" });
    updateMetrics((prev) => ({ ...prev, completedCount: prev.completedCount + 1 }));
    // 队首片段播放完毕后，后续 ready 片段可能需要触发字幕（如前面有 failed 片段挡住时）
    flushReadySubtitles();
  } finally {
    playingRef.current = false;
    audioRef.current = null;
    scheduleWork();
  }
}
```

公开 API：

```typescript
  const enqueue = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    queueRef.current = [
      ...queueRef.current,
      {
        id: nextIdRef.current,
        text: trimmed,
        status: "queued",
        attempts: 0,
        audio: null,
        error: null,
      },
    ];
    nextIdRef.current += 1;
    syncQueueSize();
    updateMetrics((prev) => ({
      ...prev,
      enqueuedCount: prev.enqueuedCount + 1,
      firstEnqueuedAt: prev.firstEnqueuedAt ?? now(),
    }));
    scheduleWork();
  }, [syncQueueSize, updateMetrics]);

  const resetMetrics = useCallback(() => {
    metricsRef.current = emptyMetrics;
    setMetrics(emptyMetrics);
  }, []);

  const getMetricsSnapshot = useCallback(() => metricsRef.current, []);

  const stop = useCallback(() => {
    generationRef.current += 1;
    queueRef.current = [];
    playingRef.current = false;
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current.clear();

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.onplay = null;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }

    setCurrentText("");
    setQueueSize(0);
    setState("idle");
    resolveWaiters();
  }, [resolveWaiters]);

  const waitForIdle = useCallback(() => {
    const active = queueRef.current.some((item) => !["done", "failed"].includes(item.status));
    if (!active && !playingRef.current) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        // 30s 超时兜底：防止 audio.onended 永不触发导致永久卡住
        console.warn("TTS waitForIdle timeout after 30s, force resolving");
        waitersRef.current = waitersRef.current.filter((w) => w !== wrapped);
        stop();
        resolve();
      }, 30_000);
      const wrapped = () => {
        clearTimeout(timer);
        resolve();
      };
      waitersRef.current = [...waitersRef.current, wrapped];
    });
  }, [stop]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return {
    enqueue,
    waitForIdle,
    stop,
    resetMetrics,
    getMetricsSnapshot,
    state,
    currentText,
    queueSize,
    metrics,
  };
}
```

如果 TypeScript 报函数声明顺序或闭包依赖问题，优先把 `scheduleWork`、`playNextReady`、`synthesizeItem` 改成函数声明或 ref 包装；不要退回到顺序合成。

- [ ] **步骤 5：运行 Hook 测试确认 GREEN**

```bash
pnpm test src/hooks/__tests__/useTTS.test.ts
```

预期：全部通过。

- [ ] **步骤 6：提交**

```bash
git add src/hooks/useTTS.ts src/hooks/__tests__/useTTS.test.ts package.json pnpm-lock.yaml
git commit -m "feat: queue tts with retry and prefetch"
```

---

## 任务 3：让 VoiceInterview 边读 SSE 边入队 TTS，并按已合成片段展示字幕

**文件：**

- 修改：`src/components/interview/VoiceInterview.tsx`

- [ ] **步骤 1：更新 import 和 Hook 解构**

新增 import：

```typescript
import { createStreamingTextSegmenter } from "@/lib/streamingTextSegmenter";
```

新增字幕等待状态和全文引用（供 `onSegmentError` 回退展示）：

```typescript
const [subtitleLoading, setSubtitleLoading] = useState(false);
const fullContentRef = useRef("");
```

将：

```typescript
const { speak, state: ttsState } = useTTS();
```

替换为：

```typescript
const {
  enqueue,
  waitForIdle,
  stop: stopTTS,
  resetMetrics,
  getMetricsSnapshot,
  state: ttsState,
  queueSize,
} = useTTS({
  maxRetries: 2,
  prefetchLimit: 3,
  onSegmentReady: (text) => {
    setSubtitleLoading(false);
    setSubtitle((prev) => `${prev}${text}`);
  },
  onSegmentError: (_text, _error) => {
    // 单段失败 → 停止全部 TTS → 展示全文回退字幕 → 恢复录音按钮
    setSubtitleLoading(false);
    setSubtitle(fullContentRef.current);
    setAppState("waiting_for_user");
    toast.warning("语音合成失败，请查看文字继续回答");
  },
});
```

- [ ] **步骤 2：在每轮 AI 回复开始时重置字幕和指标**

在 `sendToChat` 的 `setAppState("processing")` 后添加：

```typescript
setSubtitle("");
setSubtitleLoading(false);
pendingSubtitleRef.current = "";
fullContentRef.current = "";
resetMetrics();
```

- [ ] **步骤 2.5：确保 autoplay 已解锁**

在 `handleStartRecording` 中添加一个无操作 AudioContext 解锁（首次用户手势后调用，确保后续 TTS 播放不被浏览器拦截）：

```typescript
const handleStartRecording = useCallback(() => {
  // 解锁 AudioContext（Safari/Firefox 要求首次 play 在用户手势内）
  const unlock = new AudioContext();
  unlock.resume().then(() => unlock.close()).catch(() => {});
  // ... 原有逻辑
  lastRecognizedRef.current = "";
  startListening();
  setAppState("user_speaking");
}, [startListening]);
```

- [ ] **步骤 3：初始化分句器和延迟计时**

在读取 SSE 前添加：

```typescript
const segmenter = createStreamingTextSegmenter();
const chatStartedAt = performance.now();
let firstChunkAt: number | null = null;
let fullContent = "";
let hasQueuedSpeech = false;
```

- [ ] **步骤 4：改造 chunk 处理逻辑**

将 `event.type === "chunk"` 分支替换为：

```typescript
if (event.type === "chunk") {
  const content = typeof event.content === "string" ? event.content : "";
  if (!content) continue;

  firstChunkAt = firstChunkAt ?? performance.now();
  fullContent += content;
  fullContentRef.current = fullContent;

  const segments = segmenter.push(content);
  for (const segment of segments) {
    enqueue(segment);
    hasQueuedSpeech = true;
  }

  if (hasQueuedSpeech) {
    setSubtitleLoading(true);
    setAppState("ai_speaking");
  }
}
```

注意：这里不要再 `setSubtitle((prev) => prev + content)`。字幕只能由 `onSegmentReady` 追加，因为用户要求“每合成完一个片段才展示这个片段的文本”。

- [ ] **步骤 5：改造 done 处理逻辑**

将 `event.type === "done"` 分支替换为：

```typescript
if (event.type === "done") {
  fullContentRef.current = fullContent;
  const tailSegments = segmenter.flush();
  for (const segment of tailSegments) {
    enqueue(segment);
    hasQueuedSpeech = true;
  }

  if (hasQueuedSpeech) {
    setSubtitleLoading(true);
    setAppState("ai_speaking");
  }
}
```

- [ ] **步骤 6：替换完整回复后单次 speak**

将旧的：

```typescript
pendingSubtitleRef.current = fullContent;
setAppState("ai_speaking");
try {
  await speak(fullContent);
} catch {
  // TTS failed — subtitle still visible
}
setAppState("waiting_for_user");
```

替换为：

```typescript
if (!hasQueuedSpeech && fullContent.trim()) {
  enqueue(fullContent);
  setSubtitleLoading(true);
  setAppState("ai_speaking");
}

await waitForIdle();
setSubtitleLoading(false);

const metrics = getMetricsSnapshot();
const ended = fullContent.includes("面试环节已结束");

console.info("voice_turn_latency", {
  interviewId,
  chars: fullContent.length,
  segments: metrics.enqueuedCount,
  retries: metrics.retriedCount,
  failedSegments: metrics.failedCount,
  firstTokenMs: firstChunkAt === null ? null : Math.round(firstChunkAt - chatStartedAt),
  firstAudioReadyMs: metrics.firstAudioReadyAt === null ? null : Math.round(metrics.firstAudioReadyAt - chatStartedAt),
  firstPlaybackMs: metrics.firstPlaybackStartedAt === null ? null : Math.round(metrics.firstPlaybackStartedAt - chatStartedAt),
});

if (ended) {
  finishInterview();
  return;
}

setAppState("waiting_for_user");
```

- [ ] **步骤 7：更新字幕组件传参以支持等待动效**

把 `SubtitleBar` 调用改成：

```tsx
<SubtitleBar
  text={subtitleLoading && !subtitle ? "正在组织问题..." : subtitle}
  visible={ttsState === "loading" || ttsState === "playing" || appState === "waiting_for_user"}
  loading={subtitleLoading && !subtitle}
/>
```

如果 `SubtitleBar` 当前没有 `loading` prop，给 `src/components/interview/SubtitleBar.tsx` 增加可选参数：

```typescript
interface SubtitleBarProps {
  text: string;
  visible: boolean;
  loading?: boolean;
}
```

并在 `loading === true` 时显示跳动点动效：

```tsx
export default function SubtitleBar({ text, visible, loading }: SubtitleBarProps) {
  if (!visible || (!text && !loading)) {
    return <div className="min-h-[44px]" />;
  }

  return (
    <div className="px-4 py-2.5 mx-2 rounded-lg bg-indigo-500/8 border border-indigo-400/15 text-center min-h-[44px] flex items-center justify-center">
      {loading ? (
        <span className="inline-flex items-center gap-1">
          <span className="text-sm text-slate-400">{text || "正在组织问题..."}</span>
          <span className="inline-flex gap-0.5 ml-1">
            <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce-dot [animation-delay:0ms]" />
            <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce-dot [animation-delay:150ms]" />
            <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce-dot [animation-delay:300ms]" />
          </span>
        </span>
      ) : (
        <p key={text} className="text-sm text-slate-200 leading-relaxed animate-fadeIn">
          &ldquo;{text}&rdquo;
        </p>
      )}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce-dot {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
        .animate-fadeIn { animation: fadeIn 0.35s ease-out; }
        .animate-bounce-dot { animation: bounce-dot 1.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
```

- [ ] **步骤 8：调整头像等待状态**

将 `avatarState` 计算里的 TTS 状态改成：

```typescript
const avatarState = !loaded
  ? "thinking"
  : ttsState === "playing"
    ? "speaking"
    : ttsState === "loading" || queueSize > 0
      ? "thinking"
      : appState === "ai_speaking"
        ? "thinking"
        : appState === "user_speaking"
          ? "listening"
          : appState === "processing"
            ? "thinking"
            : "idle";
```

这样首段还在合成、或后续片段正在预合成时，AI 侧仍有等待动效。

- [ ] **步骤 9：结束面试和组件卸载时停止 TTS**

在 `finishInterview` 开始处添加：

```typescript
stopTTS();
```

新增 cleanup（使用 ref 避免 `stopTTS` 引用变化导致 effect 反复执行）：

```typescript
const stopTTSRef = useRef(stopTTS);
stopTTSRef.current = stopTTS;

useEffect(() => {
  return () => {
    abortRef.current?.abort();
    stopTTSRef.current();
  };
}, []);
```

- [ ] **步骤 10：更新初始历史消息播放**

将初始加载处的：

```typescript
speak(lastMsg.content)
  .then(() => {
    setAppState("waiting_for_user");
  })
  .catch(() => {
    setAppState("waiting_for_user");
  });
```

替换为：

```typescript
setSubtitle("");
setSubtitleLoading(true);
enqueue(lastMsg.content);
waitForIdle().finally(() => {
  setSubtitleLoading(false);
  setAppState("waiting_for_user");
});
```

- [ ] **步骤 11：运行构建检查**

```bash
pnpm build
```

预期：无 TypeScript 或 Next.js 构建错误。

- [ ] **步骤 12：提交**

```bash
git add src/components/interview/VoiceInterview.tsx src/components/interview/SubtitleBar.tsx
git commit -m "feat: show ready tts subtitles with loading state"
```

---

## 任务 4：焦点测试和回归检查

**文件：**

- 不预期新增文件；如发现实现问题，只修改前述相关文件。

- [ ] **步骤 1：运行分句器和 Hook 测试**

```bash
pnpm test src/lib/__tests__/streamingTextSegmenter.test.ts src/hooks/__tests__/useTTS.test.ts
```

预期：全部通过。

- [ ] **步骤 2：运行完整测试**

```bash
pnpm test
```

预期：所有 Vitest 测试通过。

- [ ] **步骤 3：运行 lint**

```bash
pnpm lint
```

预期：无 ESLint 错误。

- [ ] **步骤 4：运行生产构建**

```bash
pnpm build
```

预期：构建成功。

- [ ] **步骤 5：手动验证语音面试**

启动应用：

```bash
pnpm dev
```

手动场景：

1. 创建或打开一个语音面试。
2. 回答一个问题。
3. 确认 DeepSeek streaming 时不会直接展示原始 chunk 字幕。
4. 确认首个 TTS 片段合成完成后才展示该片段字幕。
5. 确认首段合成等待期间有“正在组织问题...”或等效动效。
6. 确认当前音频播放时，下一段会提前请求 `/api/tts`。
7. 模拟单段 TTS 失败，确认会重试，超过上限后停止全部后续 TTS，toast 提示，字幕展示全文。
8. 确认多段音频不重叠、不乱序。
9. 确认录音按钮只在 TTS 队列结束后可用。
10. 结束面试时确认当前 TTS 会停止。

- [ ] **步骤 6：查看变更范围**

```bash
git diff -- src/lib/streamingTextSegmenter.ts src/hooks/useTTS.ts src/components/interview/VoiceInterview.tsx src/components/interview/SubtitleBar.tsx
```

预期：变更只围绕分句器、TTS 队列、字幕状态和语音面试编排。

- [ ] **步骤 7：提交验证修复**

如果步骤 1-6 中有必要修复，修复后提交：

```bash
git add src/lib src/hooks src/components/interview/VoiceInterview.tsx src/components/interview/SubtitleBar.tsx package.json pnpm-lock.yaml
git commit -m "test: verify streaming tts latency reduction"
```

---

## 实施注意事项

- 不要改 `/api/chat` 的 SSE 响应格式。
- 不要改 `/api/tts` 的请求和响应格式。
- 不要把完整简历、用户回答或 AI 完整回复写入客户端日志。
- `VoiceInterview` 中不要再等待完整 `fullContent` 才启动 TTS。
- 字幕不要直接跟 DeepSeek chunk 走，只能跟 TTS `onSegmentReady` 走。
- 队列播放必须保证同一时刻只有一个 `HTMLAudioElement` 正在播放。
- 预合成可以并发请求后续片段，但播放必须严格按队列顺序。
- 单段失败先重试；达到上限后**停止全部后续 TTS**，toast 提示用户，字幕回退展示全文，恢复录音按钮。
- 如果后续接入 TTS WebSocket，只替换 `useTTS` 内部实现，保持 `VoiceInterview` 的 `enqueue()` 调用不变。
- 首次 AudioContext 必须在用户手势（点击录音按钮）内解锁，否则 Safari/Firefox 会拦截 Audio.play()。
- `waitForIdle()` 内置 30s 超时兜底，防止 audio.onended 永不触发导致永久卡住。
- `prefetchLimit = 3` 意味着最多 4 个并发 `/api/tts` 请求，在浏览器 HTTP/1.1 的 6 连接限制内安全。
