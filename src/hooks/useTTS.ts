"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ── types ──────────────────────────────────────────────────

export type TTSQueueState = "idle" | "loading" | "playing" | "error";

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
  status: "queued" | "loading" | "ready" | "playing" | "done" | "failed";
  attempts: number;
  audio: string | null;
  error: string | null;
  subtitleFired: boolean;
}

interface UseTTSReturn {
  speak: (text: string) => Promise<void>;
  enqueue: (text: string) => void;
  stop: () => void;
  state: TTSQueueState;
  currentText: string;
  queueSize: number;
  metrics: TTSMetrics;
  resetMetrics: () => void;
  getMetricsSnapshot: () => TTSMetrics;
  waitForIdle: () => Promise<void>;
}

// ── constants ──────────────────────────────────────────────

const RETRY_DELAYS = [300, 800];

// ── implementation ─────────────────────────────────────────

export function useTTS(options: UseTTSOptions = {}): UseTTSReturn {
  const {
    maxRetries = 2,
    prefetchLimit = 3,
    onSegmentReady,
    onSegmentStart,
    onSegmentError,
  } = options;

  const [state, setState] = useState<TTSQueueState>("idle");
  const [currentText, setCurrentText] = useState("");
  const [queueSize, setQueueSize] = useState(0);
  const [metrics, setMetrics] = useState<TTSMetrics>({
    enqueuedCount: 0,
    retriedCount: 0,
    completedCount: 0,
    failedCount: 0,
    firstEnqueuedAt: null,
    firstAudioReadyAt: null,
    firstPlaybackStartedAt: null,
  });

  // Mutable refs to avoid stale closure issues in async callbacks
  const queueRef = useRef<QueueItem[]>([]);
  const nextIdRef = useRef(0);
  const generationRef = useRef(0);
  const activeSynthesisRef = useRef(0);
  const playingRef = useRef(false);
  const abortControllersRef = useRef<Map<number, AbortController>>(new Map());
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Metrics
  const metricsRef = useRef<TTSMetrics>({
    enqueuedCount: 0,
    retriedCount: 0,
    completedCount: 0,
    failedCount: 0,
    firstEnqueuedAt: null,
    firstAudioReadyAt: null,
    firstPlaybackStartedAt: null,
  });

  // Waiters for waitForIdle
  const waitersRef = useRef<Array<() => void>>([]);

  // ── helper: sync state from refs ──────────────────────────

  function syncQueueSizeState() {
    setQueueSize(
      queueRef.current.filter(
        (item) => !["done", "failed"].includes(item.status),
      ).length,
    );
  }

  function syncMetricsState() {
    setMetrics({ ...metricsRef.current });
  }

  // ── helper: delay ────────────────────────────────────────

  function delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ── helper: resolve all waiters ─────────────────────────

  function resolveWaiters() {
    const w = waitersRef.current;
    waitersRef.current = [];
    for (const resolve of w) resolve();
  }

  // ── helper: abort all pending synthesis ──────────────────

  function abortAll(gen: number) {
    if (gen !== generationRef.current) return;
    for (const [id, ctrl] of abortControllersRef.current) {
      ctrl.abort();
      abortControllersRef.current.delete(id);
    }
    activeSynthesisRef.current = 0;
  }

  // ── helper: stop all after failure ───────────────────────

  function stopAllAfterFailure(failedItem: QueueItem) {
    // Stop audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current.onplay = null;
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      currentAudioRef.current = null;
    }
    playingRef.current = false;

    // Abort all pending synthesis
    abortAll(generationRef.current);

    // Clear all other queued/loading/ready items
    for (const item of queueRef.current) {
      if (item.id !== failedItem.id) {
        item.status = "failed";
        item.error = "stopped due to prior failure";
      }
    }

    setState("error");
    metricsRef.current.failedCount += 1;
    syncMetricsState();
    syncQueueSizeState();
    optionsRef.current.onSegmentError?.(
      failedItem.text,
      new Error(failedItem.error || "TTS synthesis failed after max retries"),
    );
    resolveWaiters();
  }

  // ── flushReadySubtitles ──────────────────────────────────

  function flushReadySubtitles() {
    const queue = queueRef.current;
    const readyCb = optionsRef.current.onSegmentReady;
    if (!readyCb) return;

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (
        item.status === "done" ||
        item.status === "failed" ||
        item.subtitleFired
      ) {
        continue;
      }
      if (item.status !== "ready" && item.status !== "playing") {
        break;
      }
      item.subtitleFired = true;
      readyCb(item.text);
    }
  }

  // ── playNextReady ────────────────────────────────────────

  function playNextReady(gen: number) {
    if (gen !== generationRef.current) return;
    if (playingRef.current) return;

    const queue = queueRef.current;

    // Find first non-done, non-failed item
    let nextItem: QueueItem | null = null;
    for (const item of queue) {
      if (item.status !== "done" && item.status !== "failed") {
        nextItem = item;
        break;
      }
    }

    if (!nextItem) {
      setState("idle");
      setCurrentText("");
      syncQueueSizeState();
      resolveWaiters();
      return;
    }

    if (nextItem.status === "ready") {
      playingRef.current = true;
      nextItem.status = "playing";
      setState("playing");
      setCurrentText(nextItem.text);

      const audio = new Audio(nextItem.audio!);
      currentAudioRef.current = audio;
      audio.playbackRate = 1.3;

      let settled = false;

      audio.onplay = () => {
        if (settled) return;
        if (metricsRef.current.firstPlaybackStartedAt === null) {
          metricsRef.current.firstPlaybackStartedAt = Date.now();
          syncMetricsState();
        }
        optionsRef.current.onSegmentStart?.(nextItem!.text);
      };

      function onAudioComplete() {
        if (settled) return;
        settled = true;
        nextItem!.status = "done";
        metricsRef.current.completedCount += 1;
        syncMetricsState();
        syncQueueSizeState();
        currentAudioRef.current = null;
        playingRef.current = false;

        flushReadySubtitles();
        scheduleWork(gen);
        playNextReady(gen);
      }

      audio.onended = onAudioComplete;
      audio.onerror = onAudioComplete;

      audio.play().catch(onAudioComplete);
      syncQueueSizeState();
    } else {
      // Still queued or loading
      setState("loading");
    }
  }

  // ── synthesizeItem ───────────────────────────────────────

  async function synthesizeItem(itemId: number, gen: number) {
    if (gen !== generationRef.current) return;

    const queue = queueRef.current;
    const item = queue.find((qi) => qi.id === itemId);
    if (!item || item.status !== "queued") return;

    item.status = "loading";
    item.attempts += 1;

    const abort = new AbortController();
    abortControllersRef.current.set(itemId, abort);

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: item.text }),
        signal: abort.signal,
      });

      if (gen !== generationRef.current) return;

      abortControllersRef.current.delete(itemId);
      activeSynthesisRef.current -= 1;

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "TTS request failed");
      }

      const data = await res.json();
      if (!data.audio) throw new Error("TTS response missing audio");

      item.status = "ready";
      item.audio = data.audio;

      if (metricsRef.current.firstAudioReadyAt === null) {
        metricsRef.current.firstAudioReadyAt = Date.now();
      }
      syncMetricsState();

      flushReadySubtitles();
      scheduleWork(gen);
      playNextReady(gen);
    } catch (err) {
      if (gen !== generationRef.current) return;

      abortControllersRef.current.delete(itemId);
      activeSynthesisRef.current -= 1;

      if ((err as Error).name === "AbortError") return;

      const attempt = item.attempts;
      if (attempt <= maxRetries && item.status === "loading") {
        metricsRef.current.retriedCount += 1;
        syncMetricsState();
        item.status = "queued"; // reset for retry
        const retryIndex = attempt - 1;
        const delayMs = RETRY_DELAYS[retryIndex] ?? 800;
        await delay(delayMs);

        if (gen !== generationRef.current) return;
        if (item.status !== "queued") return;

        scheduleWork(gen);
        return;
      }

      // Max retries exhausted
      item.status = "failed";
      item.error = (err as Error).message || "TTS synthesis failed";
      stopAllAfterFailure(item);
    }
  }

  // ── scheduleWork ────────────────────────────────────────

  function scheduleWork(gen: number) {
    if (gen !== generationRef.current) return;

    const maxConcurrent = prefetchLimit + 1;
    const capacity = maxConcurrent - activeSynthesisRef.current;

    if (capacity <= 0) return;

    const queue = queueRef.current;
    let launched = 0;
    for (const item of queue) {
      if (launched >= capacity) break;
      if (item.status === "queued") {
        activeSynthesisRef.current += 1;
        launched += 1;
        setTimeout(() => synthesizeItem(item.id, gen), 0);
      }
    }

    if (!playingRef.current) {
      playNextReady(gen);
    }
  }

  // ── stop ─────────────────────────────────────────────────

  const stop = useCallback(() => {
    generationRef.current += 1;
    const gen = generationRef.current;

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current.onplay = null;
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      currentAudioRef.current = null;
    }
    playingRef.current = false;

    abortAll(gen);
    queueRef.current = [];
    setState("idle");
    setCurrentText("");
    setQueueSize(0);
    resolveWaiters();
  }, []);

  // ── enqueue ──────────────────────────────────────────────

  const enqueue = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length === 0) return;

      if (metricsRef.current.firstEnqueuedAt === null) {
        metricsRef.current.firstEnqueuedAt = Date.now();
      }
      metricsRef.current.enqueuedCount += 1;
      syncMetricsState();

      const id = nextIdRef.current;
      nextIdRef.current += 1;

      const item: QueueItem = {
        id,
        text: trimmed,
        status: "queued",
        attempts: 0,
        audio: null,
        error: null,
        subtitleFired: false,
      };

      queueRef.current.push(item);
      syncQueueSizeState();

      const gen = generationRef.current;
      setTimeout(() => scheduleWork(gen), 0);
    },
    [],
  );

  // ── speak (backward-compatible wrapper) ──────────────────

  const speak = useCallback(
    async (text: string): Promise<void> => {
      stop();
      enqueue(text);
      // waitForIdle is stable enough for this pattern
      return new Promise<void>((resolve) => {
        waitersRef.current.push(resolve);
        // 30s safety timeout
        const timeout = setTimeout(() => {
          const idx = waitersRef.current.indexOf(resolve);
          if (idx >= 0) {
            waitersRef.current.splice(idx, 1);
            resolve();
          }
        }, 30000);
        // Clean up timeout on normal resolution
        const origResolve = resolve;
        const wrappedResolve = () => {
          clearTimeout(timeout);
          origResolve();
        };
        const idx = waitersRef.current.indexOf(resolve);
        if (idx >= 0) waitersRef.current[idx] = wrappedResolve;
      });
    },
    [stop, enqueue],
  );

  // ── metrics ──────────────────────────────────────────────

  const resetMetrics = useCallback(() => {
    metricsRef.current = {
      enqueuedCount: 0,
      retriedCount: 0,
      completedCount: 0,
      failedCount: 0,
      firstEnqueuedAt: null,
      firstAudioReadyAt: null,
      firstPlaybackStartedAt: null,
    };
    setMetrics({ ...metricsRef.current });
  }, []);

  const getMetricsSnapshot = useCallback((): TTSMetrics => {
    return { ...metricsRef.current };
  }, []);

  // ── waitForIdle ──────────────────────────────────────────

  const waitForIdle = useCallback((): Promise<void> => {
    return new Promise<void>((resolve) => {
      const queue = queueRef.current;
      const hasActive = queue.some(
        (qi) => qi.status !== "done" && qi.status !== "failed",
      );

      if (!hasActive && !playingRef.current) {
        resolve();
        return;
      }

      waitersRef.current.push(resolve);

      // 30s safety timeout
      setTimeout(() => {
        const idx = waitersRef.current.indexOf(resolve);
        if (idx >= 0) {
          waitersRef.current.splice(idx, 1);
          stop();
          resolve();
        }
      }, 30000);
    });
  }, [stop]);

  // ── cleanup on unmount ───────────────────────────────────

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      const cleanupGen = generationRef.current;

      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current.onplay = null;
        currentAudioRef.current.onended = null;
        currentAudioRef.current.onerror = null;
        currentAudioRef.current = null;
      }
      playingRef.current = false;
      abortAll(cleanupGen);
      queueRef.current = [];
      resolveWaiters();
    };
  }, []);

  return {
    speak,
    enqueue,
    stop,
    state,
    currentText,
    queueSize,
    metrics,
    resetMetrics,
    getMetricsSnapshot,
    waitForIdle,
  };
}
