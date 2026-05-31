import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTTS } from "@/hooks/useTTS";
import type { TTSMetrics } from "@/hooks/useTTS";

// ── helpers ────────────────────────────────────────────────

/**
 * Build a fetch mock that returns the given responses in sequence.
 * Each entry is either a resolved Response or a rejected error.
 */
function mockFetchSequence(...responses: (Response | Error)[]) {
  let callCount = 0;
  return vi.fn(
    () =>
      new Promise<Response>((resolve, reject) => {
        const entry = responses[callCount];
        callCount += 1;
        // Use minimal delay so fake timers can advance it.
        if (entry instanceof Error) {
          reject(entry);
        } else {
          resolve(entry);
        }
      }),
  );
}

/** Build a successful TTS Response with a mock audio data URI. */
function ttsResponse(): Response {
  return new Response(
    JSON.stringify({ audio: "data:audio/wav;base64,bW9ja2F1ZGlv" }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

/** Build a failed TTS Response (e.g. 502). */
function ttsErrorResponse(): Response {
  return new Response(JSON.stringify({ error: "synthesis failed" }), {
    status: 502,
    headers: { "Content-Type": "application/json" },
  });
}

/** Collect audio instances created during a test so we can inspect/trigger them. */
let audioInstances: MockAudio[] = [];

class MockAudio {
  src: string = "";
  playbackRate: number = 1;
  onplay: ((this: HTMLAudioElement, ev: Event) => unknown) | null = null;
  onended: ((this: HTMLAudioElement, ev: Event) => unknown) | null = null;
  onerror: ((this: HTMLAudioElement, ev: Event | string) => unknown) | null = null;

  constructor(src: string) {
    this.src = src;
    audioInstances.push(this);
  }

  play(): Promise<void> {
    return Promise.resolve();
  }

  pause(): void {}

  /** Helper: simulate the Audio element starting to play. */
  emitPlay() {
    if (this.onplay) {
      // Use a minimal fake event since we only check for the callback call.
      this.onplay.call(null as unknown as HTMLAudioElement, new Event("play"));
    }
  }

  /** Helper: simulate the Audio element reaching the end. */
  emitEnded() {
    if (this.onended) {
      this.onended.call(
        null as unknown as HTMLAudioElement,
        new Event("ended"),
      );
    }
  }

  /** Helper: simulate a playback error. */
  emitError() {
    if (this.onerror) {
      this.onerror.call(
        null as unknown as HTMLAudioElement,
        new Event("error"),
      );
    }
  }
}

// ── lifecycle ──────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  vi.stubGlobal("Audio", MockAudio);
  audioInstances = [];
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ── tests ──────────────────────────────────────────────────

describe("useTTS", () => {
  // ── 1. basic enqueue + play + idle ───────────────────────
  test("入队一个片段后请求TTS并播放音频，onended后state回到idle", async () => {
    const fetchMock = mockFetchSequence(ttsResponse());
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTTS());

    // enqueue
    await act(async () => {
      result.current.enqueue("你好");
    });

    // The hook schedules synthesis (setTimeout 0), advance fake timers.
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // fetch should have been called once
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/tts", expect.objectContaining({ method: "POST" }));

    // audio should exist and be playing
    expect(audioInstances.length).toBe(1);
    const audio = audioInstances[0];
    expect(audio.src).toContain("data:audio/wav;base64,");

    // simulate onplay
    await act(async () => {
      audio.emitPlay();
    });
    expect(result.current.state).toBe("playing");

    // simulate onended
    await act(async () => {
      audio.emitEnded();
    });
    expect(result.current.state).toBe("idle");

    // metrics
    const metrics = result.current.getMetricsSnapshot();
    expect(metrics.completedCount).toBe(1);
    expect(metrics.failedCount).toBe(0);
  });

  // ── 2. pre-synthesis ─────────────────────────────────────
  test("当前片段播放时预合成后续片段（prefetchLimit:1），第2段先resolve不会创建Audio", async () => {
    // We'll use a fake fetch that we can resolve manually to control order.
    let resolve1!: (value: Response) => void;
    let resolve2!: (value: Response) => void;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((r) => {
            resolve1 = r;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Response>((r) => {
            resolve2 = r;
          }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTTS({ prefetchLimit: 1 }));

    // enqueue two segments
    await act(async () => {
      result.current.enqueue("第一段");
      result.current.enqueue("第二段");
    });

    // advance timers so synthesis of segment 1 starts
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // fetch should have been called once for segment 1 (prefetchLimit 1 = only 1 extra, but with 1 playing it allows 1 more)
    // Actually: capacity = (prefetchLimit + 1) - activeSynthesis.
    // After first synthesis starts, activeSynthesis = 1, capacity = 2 - 1 = 1, so second fetch SHOULD start.
    // Wait... the first fetch is pending, so activeSynthesis = 1 initially. But capacity on first scheduleWork call has activeSynthesis = 0, so 2 start.
    // Let me reconsider. When we first scheduleWork, activeSynthesis = 0, capacity = (1+1) - 0 = 2. Both start.
    // Actually let me just check the result.

    // Both fetch calls should have been initiated
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Now resolve segment 2 FIRST (before segment 1)
    await act(async () => {
      resolve2(ttsResponse());
    });

    // advance timers so flushReadySubtitles runs
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // No audio should be created yet because segment 1 isn't ready/playing
    expect(audioInstances.length).toBe(0);

    // Now resolve segment 1
    await act(async () => {
      resolve1(ttsResponse());
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Now an audio should be created for segment 1
    expect(audioInstances.length).toBe(1);
    const audio = audioInstances[0];
    expect(audio.src).toContain("data:audio/wav;base64,");

    // Simulate play + end for segment 1
    await act(async () => {
      audio.emitPlay();
    });
    await act(async () => {
      audio.emitEnded();
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // After segment 1 ends, segment 2 should play (it's already ready)
    expect(audioInstances.length).toBe(2);
  });

  // ── 3. retry on single failure ───────────────────────────
  test("单个片段失败后重试（fetch前2次返回error，第3次成功），验证fetch被调用3次", async () => {
    const fetchMock = mockFetchSequence(
      ttsErrorResponse(), // fail 1
      ttsErrorResponse(), // fail 2
      ttsResponse(), // success 3
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTTS({ maxRetries: 2 }));

    await act(async () => {
      result.current.enqueue("你好");
      // runAllTimersAsync processes all retries and their delays
      await vi.runAllTimersAsync();
    });

    // All 3 fetch calls (initial + 2 retries) completed
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(audioInstances.length).toBe(1);

    const metrics = result.current.getMetricsSnapshot();
    expect(metrics.retriedCount).toBe(2);
    expect(metrics.failedCount).toBe(0);
  });

  // ── 4. max retries exhausted → stop all ─────────────────
  test("超过重试上限后停止全部后续（maxRetries:1），state为error，onSegmentError被调用", async () => {
    const fetchMock = mockFetchSequence(
      ttsErrorResponse(), // fail 1
      ttsErrorResponse(), // fail 2 (exhausted for maxRetries=1)
    );
    vi.stubGlobal("fetch", fetchMock);
    const onSegmentError = vi.fn();

    const { result } = renderHook(() =>
      useTTS({ maxRetries: 1, onSegmentError }),
    );

    await act(async () => {
      result.current.enqueue("你好");
      await vi.runAllTimersAsync();
    });

    // 2 calls: initial + 1 retry = exhausted (maxRetries=1 means attempt 2 > 1)
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.state).toBe("error");
    expect(onSegmentError).toHaveBeenCalledTimes(1);
    expect(onSegmentError).toHaveBeenCalledWith("你好", expect.any(Error));
    expect(audioInstances.length).toBe(0);
  });

  // ── 5. onSegmentReady ordered ────────────────────────────
  test("onSegmentReady按队列顺序触发——第2段先合成完成也不乱序", async () => {
    let resolve1!: (value: Response) => void;
    let resolve2!: (value: Response) => void;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((r) => {
            resolve1 = r;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Response>((r) => {
            resolve2 = r;
          }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const onSegmentReady = vi.fn();

    const { result } = renderHook(() => useTTS({ onSegmentReady }));

    await act(async () => {
      result.current.enqueue("片段1");
      result.current.enqueue("片段2");
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Both synthesis started
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Resolve segment 2 first (out of order)
    await act(async () => {
      resolve2(ttsResponse());
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // onSegmentReady should NOT have been called yet (segment 1 not ready)
    expect(onSegmentReady).not.toHaveBeenCalled();

    // Now resolve segment 1
    await act(async () => {
      resolve1(ttsResponse());
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Both should now be called in order
    expect(onSegmentReady).toHaveBeenCalledTimes(2);
    expect(onSegmentReady).toHaveBeenNthCalledWith(1, "片段1");
    expect(onSegmentReady).toHaveBeenNthCalledWith(2, "片段2");
  });

  // ── 6. metrics ───────────────────────────────────────────
  test("resetMetrics清空指标，getMetricsSnapshot返回最新快照", async () => {
    const fetchMock = mockFetchSequence(ttsResponse());
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTTS());

    await act(async () => {
      result.current.enqueue("测试");
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // play and end
    const audio = audioInstances[0];
    await act(async () => {
      audio.emitPlay();
    });
    await act(async () => {
      audio.emitEnded();
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    let metrics: TTSMetrics = result.current.getMetricsSnapshot();
    expect(metrics.completedCount).toBe(1);
    expect(metrics.enqueuedCount).toBe(1);

    // reset
    act(() => {
      result.current.resetMetrics();
    });

    metrics = result.current.getMetricsSnapshot();
    expect(metrics.completedCount).toBe(0);
    expect(metrics.enqueuedCount).toBe(0);
    expect(metrics.firstEnqueuedAt).toBeNull();
  });

  // ── 7. empty string → no segment ─────────────────────────
  test("空字符串入队不产生片段，不调用fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTTS());

    await act(async () => {
      result.current.enqueue("");
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    const metrics = result.current.getMetricsSnapshot();
    expect(metrics.enqueuedCount).toBe(0);
  });

  // ── 8. stop cancels pending requests ────────────────────
  test("stop在合成中途取消pending请求", async () => {
    // We need a fetch that never resolves so we can call stop mid-flight
    let capturedSignal!: AbortSignal;
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          capturedSignal = init?.signal as AbortSignal;
          capturedSignal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTTS());

    await act(async () => {
      result.current.enqueue("测试");
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(capturedSignal!).toBeDefined();
    expect(capturedSignal!.aborted).toBe(false);

    // Call stop
    await act(async () => {
      result.current.stop();
    });

    // The signal should now be aborted
    expect(capturedSignal!.aborted).toBe(true);
  });

  // ── 9. fast sequential enqueue preserves order ───────────
  test("快速连续入队3个片段，验证播放顺序", async () => {
    const fetchMock = mockFetchSequence(
      ttsResponse(),
      ttsResponse(),
      ttsResponse(),
    );
    vi.stubGlobal("fetch", fetchMock);
    const playOrder: string[] = [];

    const { result } = renderHook(() =>
      useTTS({
        onSegmentStart: (text) => {
          playOrder.push(text);
        },
      }),
    );

    // Enqueue all 3 at once and let all syntheses complete
    await act(async () => {
      result.current.enqueue("片段A");
      result.current.enqueue("片段B");
      result.current.enqueue("片段C");
      await vi.runAllTimersAsync();
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Play through all 3 in sequence
    // Each emitEnded triggers playNextReady synchronously which creates the next Audio
    for (let i = 0; i < 3; i++) {
      expect(audioInstances.length).toBe(i + 1);
      const audio = audioInstances[i];
      await act(async () => {
        audio.emitPlay();
      });
      await act(async () => {
        audio.emitEnded();
      });
    }
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Verify play order matches enqueue order
    expect(playOrder).toEqual(["片段A", "片段B", "片段C"]);
  });
});
