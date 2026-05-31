# 流式 TTS 语音输出 — 代码架构与流程

**日期：** 2026-05-31
**关联：** [spec.md](./spec.md) · [plan.md](./plan.md)

## 架构全景

```
用户录音结束
    │
    ▼
VoiceInterview.sendToChat()          ← 总控制器
    │
    ├─▶ POST /api/chat (SSE)         ← DeepSeek 流式生成
    │     │
    │     ├─ chunk → segmenter.push() ← 文本分句器
    │     │            │
    │     │            └─ enqueue()   ← TTS 队列
    │     │
    │     └─ done → segmenter.flush() → enqueue()
    │
    └─▶ waitForIdle()                ← 等待全部播放完毕
```

### 文件职责

| 文件 | 职责 |
|------|------|
| `src/components/interview/VoiceInterview.tsx` | 总控制器：管理 SSE 读取、分句、入队、字幕、状态机 |
| `src/lib/streamingTextSegmenter.ts` | 纯函数分句器：将流式文本切分为适合 TTS 的片段 |
| `src/hooks/useTTS.ts` | TTS 队列 Hook：合成调度、重试、预取、顺序播放 |
| `src/components/interview/SubtitleBar.tsx` | 字幕展示组件：加载动效 + 流式文字追加 |

---

## Phase 1：发起请求与初始化

用户说完话、ASR 识别完成后，`handleStopRecording` → `sendToChat(recognized)`。

```typescript
// VoiceInterview.tsx:126
const sendToChat = useCallback(async (userMsg: string) => {
  // 重置本轮状态
  setAppState("processing");
  setSubtitle("");
  setSubtitleLoading(false);
  fullContentRef.current = "";          // 全文缓存（TTS 失败时回退展示用）
  resetMetrics();                       // 清空延迟指标

  // 每轮 AI 回复创建独立的分句器实例
  const segmenter = createStreamingTextSegmenter();
  // 内部 buffer = ""，策略：minChars=10, targetChars=28, maxChars=48

  const chatStartedAt = performance.now(); // 延迟打点起点
  let firstChunkAt: number | null = null;
  let fullContent = "";
  let hasQueuedSpeech = false;

  // 发起 SSE 请求
  const abort = new AbortController();
  abortRef.current = abort;
  const res = await fetch("/api/chat", {
    body: JSON.stringify({ interviewId, message: userMsg }),
    signal: abort.signal,
  });
  const reader = res.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream())
    .getReader();
```

---

## Phase 2：SSE 流式读取 + 分句 + 入队

### 2a. 处理文本 chunk

DeepSeek 每输出一小段文字，浏览器收到一个 SSE `chunk` 事件。每个 chunk 实时推入分句器，而不是等到全文结束。

```typescript
// VoiceInterview.tsx:158
while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const event = JSON.parse(value.data);

  if (event.type === "chunk") {
    const content = typeof event.content === "string" ? event.content : "";
    if (!content) continue;

    firstChunkAt ??= performance.now(); // 记录首 token 时间
    fullContent += content;
    fullContentRef.current = fullContent; // 始终缓存最新全文

    // 推入分句器，获取可播放的片段列表
    const segments = segmenter.push(content);
    for (const segment of segments) {
      enqueue(segment);
      hasQueuedSpeech = true;
    }

    // 首个片段入队后切换 UI 状态
    if (hasQueuedSpeech && appState !== "ai_speaking") {
      setSubtitleLoading(true);   // 字幕栏显示 "正在组织问题..."
      setAppState("ai_speaking"); // 头像进入 thinking 态
    }
  }
}
```

**关键设计：** 字幕不直接跟着 DeepSeek 的原始 chunk 走。每个 chunk 先进分句器，分句器不输出则不追加字幕。字幕只在 TTS 合成完成时由 `onSegmentReady` 追加。

### 2b. 处理结束事件

```typescript
  // VoiceInterview.tsx:179
  else if (event.type === "done") {
    fullContentRef.current = fullContent;
    const tailSegments = segmenter.flush(); // 倒出缓冲区剩余文本
    for (const segment of tailSegments) {
      enqueue(segment);
      hasQueuedSpeech = true;
    }
  }
}
```

### 2c. 兜底处理

如果分句器始终没有输出（极端情况：回复极短，不足 `minChars` 且没有触发 flush），循环结束后兜底入队全文：

```typescript
// VoiceInterview.tsx:197
if (!hasQueuedSpeech && fullContent.trim()) {
  enqueue(fullContent);
  setSubtitleLoading(true);
  setAppState("ai_speaking");
}
```

---

## Phase 3：TTS 队列 — 合成、重试、播放

TTS 队列是核心引擎，负责把分句器输出的文本片段变成按序播放的音频流。

### 3a. 队列项状态机

```
     enqueue()
        │
        ▼
   ［queued］────── scheduleWork 启动合成 ──────▶［loading］
                                                   │
                                    ┌── 成功 ─────┤
                                    │              │
                                    ▼              │
                                ［ready］          │ 失败 ← 重试
                                    │              │
                              playNextReady        │ attempt ≤ maxRetries?
                                    │              │
                                    ▼              │ yes → delay → 回到 queued
                               ［playing］         │ no  → 进入 failed
                                    │              │
                              onended / onerror    │
                                    │              │
                                    ▼              ▼
                                ［done］        ［failed］
                                                    │
                                         stopAllAfterFailure()
                                         （清空队列、取消请求、通知 UI）
```

### 3b. 数据结构

```typescript
// useTTS.ts:27
interface QueueItem {
  id: number;              // 递增唯一 ID
  text: string;            // 文本内容
  status: "queued" | "loading" | "ready" | "playing" | "done" | "failed";
  attempts: number;        // 已尝试次数
  audio: string | null;    // base64 音频数据（ready 后填充）
  error: string | null;    // 错误信息（failed 后填充）
  subtitleFired: boolean;  // 是否已触发字幕回调（防止重复）
}
```

### 3c. enqueue() — 片段入队

```typescript
// useTTS.ts:399
const enqueue = useCallback((text: string) => {
  const trimmed = text.trim();
  if (trimmed.length === 0) return;

  // 更新延迟指标
  if (metricsRef.current.firstEnqueuedAt === null) {
    metricsRef.current.firstEnqueuedAt = Date.now();
  }
  metricsRef.current.enqueuedCount += 1;

  // 创建队列项，初始状态 = queued
  const item: QueueItem = {
    id: nextIdRef.current++,
    text: trimmed,
    status: "queued",
    attempts: 0,
    audio: null,
    error: null,
    subtitleFired: false,
  };
  queueRef.current.push(item);

  // 异步触发调度（setTimeout(0) 避免在当前调用栈中递归）
  const gen = generationRef.current;
  setTimeout(() => scheduleWork(gen), 0);
}, []);
```

### 3d. scheduleWork(gen) — 调度中心

每次队列变化时调用，负责分配合成任务和推进播放。这是生产者和消费者的桥梁。

```typescript
// useTTS.ts:349
function scheduleWork(gen: number) {
  if (gen !== generationRef.current) return; // 过期 generation，忽略

  const maxConcurrent = prefetchLimit + 1;   // 3 + 1 = 4
  const capacity = maxConcurrent - activeSynthesisRef.current;
  if (capacity <= 0) return;                 // 已达并发上限

  // 从队列中取 queued 项，启动合成
  let launched = 0;
  for (const item of queueRef.current) {
    if (launched >= capacity) break;
    if (item.status === "queued") {
      activeSynthesisRef.current += 1;
      launched += 1;
      setTimeout(() => synthesizeItem(item.id, gen), 0);
    }
  }

  // 如果没在播放，尝试消费队首 ready 片段
  if (!playingRef.current) {
    playNextReady(gen);
  }
}
```

**并发控制：** `capacity = 4 - activeSynthesisRef`。例如当前有 1 个正在合成，还有 3 个名额可用。这保证最多 4 个并行 `/api/tts` 请求，在浏览器 HTTP/1.1 的 6 连接限制内。

### 3e. synthesizeItem() — 单个片段合成

```typescript
// useTTS.ts:271
async function synthesizeItem(itemId: number, gen: number) {
  if (gen !== generationRef.current) return;

  const item = queueRef.current.find(qi => qi.id === itemId);
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

    // ── 合成成功 ──
    item.status = "ready";
    item.audio = data.audio;

    if (metricsRef.current.firstAudioReadyAt === null) {
      metricsRef.current.firstAudioReadyAt = Date.now();
    }
    syncMetricsState();

    flushReadySubtitles();  // 尝试触发字幕（仅连续 ready 的队首片段）
    scheduleWork(gen);      // 可能启动新的合成
    playNextReady(gen);     // 尝试播放
  }
  catch (err) {
    if (gen !== generationRef.current) return;
    abortControllersRef.current.delete(itemId);
    activeSynthesisRef.current -= 1;

    if ((err as Error).name === "AbortError") return; // 用户取消，静默

    // ── 重试逻辑 ──
    const attempt = item.attempts;
    if (attempt <= maxRetries && item.status === "loading") {
      metricsRef.current.retriedCount += 1;
      item.status = "queued"; // 重置为 queued

      const delayMs = RETRY_DELAYS[attempt - 1] ?? 800; // [300, 800]
      await delay(delayMs);

      if (gen !== generationRef.current) return;
      if (item.status !== "queued") return;
      scheduleWork(gen); // 重新调度合成
      return;
    }

    // ── 重试耗尽，停止一切 ──
    item.status = "failed";
    item.error = (err as Error).message || "TTS synthesis failed";
    stopAllAfterFailure(item);
  }
}
```

**重试退避策略：**

| 尝试 | 延迟 | 说明 |
|------|------|------|
| 第 1 次失败 | 300ms | 可能是网络抖动 |
| 第 2 次失败 | 800ms | 可能是服务短暂过载 |
| 第 3 次失败 | — | 达到 maxRetries=2 上限，触发 `stopAllAfterFailure` |

### 3f. playNextReady(gen) — 顺序播放

**只消费队首 ready 的片段**，这是保证音频不重叠的核心机制。

```typescript
// useTTS.ts:199
function playNextReady(gen: number) {
  if (gen !== generationRef.current) return;
  if (playingRef.current) return;        // ★ 已在播放，直接返回

  // 找第一个非 done、非 failed 的项
  let nextItem: QueueItem | null = null;
  for (const item of queueRef.current) {
    if (item.status !== "done" && item.status !== "failed") {
      nextItem = item;
      break;
    }
  }

  if (!nextItem) {
    // 队列空了 → 空闲
    setState("idle");
    setCurrentText("");
    resolveWaiters();  // ★ 唤醒所有 waitForIdle 的等待者
    return;
  }

  if (nextItem.status === "ready") {
    // ★ 队首已就绪 → 播放
    playingRef.current = true;
    nextItem.status = "playing";
    setState("playing");
    setCurrentText(nextItem.text);

    const audio = new Audio(nextItem.audio!);
    currentAudioRef.current = audio;
    audio.playbackRate = 1.3; // 1.3 倍速

    let settled = false;

    audio.onplay = () => {
      if (settled) return;
      if (metricsRef.current.firstPlaybackStartedAt === null) {
        metricsRef.current.firstPlaybackStartedAt = Date.now();
      }
      optionsRef.current.onSegmentStart?.(nextItem!.text);
    };

    function onAudioComplete() {
      if (settled) return;
      settled = true;
      nextItem!.status = "done";
      metricsRef.current.completedCount += 1;
      playingRef.current = false;

      flushReadySubtitles(); // 触发后续字幕
      scheduleWork(gen);     // 启动新的合成
      playNextReady(gen);    // ★ 递归：播放下一段
    }

    audio.onended = onAudioComplete;
    audio.onerror = onAudioComplete; // 播放错误也继续下一段
    audio.play().catch(onAudioComplete);
  }
  else {
    // 队首还是 queued / loading → 等待
    setState("loading");
  }
}
```

### 3g. flushReadySubtitles() — 有序字幕

从队首开始扫描，**只有连续 ready/playing 的片段才触发字幕回调**。遇到第一个非 ready 的片段就停止。

```typescript
// useTTS.ts:175
function flushReadySubtitles() {
  const readyCb = optionsRef.current.onSegmentReady;
  if (!readyCb) return;

  for (let i = 0; i < queueRef.current.length; i++) {
    const item = queueRef.current[i];

    // 跳过已完成或已触发字幕的
    if (item.status === "done" || item.status === "failed" || item.subtitleFired) {
      continue; // ← 跳过但不停
    }

    // 遇到非 ready/playing → 停止（有断层）
    if (item.status !== "ready" && item.status !== "playing") {
      break;    // ← 关键
    }

    item.subtitleFired = true;
    readyCb(item.text); // → VoiceInterview.setSubtitle(prev => prev + text)
  }
}
```

**为什么需要“连续”约束？** 预合成允许后续片段先于队首片段合成完成。如果没有连续约束，字幕会出现跳跃（后面句子的文字先展示），破坏用户阅读体验。

场景示意：
```
队列: [seg1: ready, seg2: queued, seg3: ready]
                         ↑ 断层
扫描:
  seg1 → ready，触发字幕 ✓
  seg2 → queued，不是 ready/playing → break
  seg3 → 跳过（被 seg2 的 break 挡住了）
```

等 seg2 合成完成后再次调用 `flushReadySubtitles`：
```
队列: [seg1: playing, seg2: ready, seg3: ready]
扫描:
  seg1 → playing，触发字幕 ✓
  seg2 → ready，触发字幕 ✓
  seg3 → ready，触发字幕 ✓  ← 连续，全部触发
```

---

## Phase 4：完成与异常处理

### 4a. 正常完成

SSE 循环结束后，等待 TTS 队列全部播放完毕：

```typescript
// VoiceInterview.tsx:204
await waitForIdle();
setSubtitleLoading(false);

// 记录延迟打点
const metrics = getMetricsSnapshot();
console.info("voice_turn_latency", {
  interviewId,
  chars: fullContent.length,
  segments: metrics.enqueuedCount,
  retries: metrics.retriedCount,
  failedSegments: metrics.failedCount,
  firstTokenMs: firstChunkAt === null ? null : Math.round(firstChunkAt - chatStartedAt),
  firstAudioReadyMs: metrics.firstAudioReadyAt === null
    ? null : Math.round(metrics.firstAudioReadyAt - chatStartedAt),
  firstPlaybackMs: metrics.firstPlaybackStartedAt === null
    ? null : Math.round(metrics.firstPlaybackStartedAt - chatStartedAt),
});

if (fullContent.includes("面试环节已结束")) {
  finishInterview(); // 停止 TTS → 调用 finish API → 跳转报告页
  return;
}

setAppState("waiting_for_user"); // 录音按钮可用
```

### 4b. waitForIdle() 的工作原理

```typescript
// useTTS.ts:485
const waitForIdle = useCallback((): Promise<void> => {
  return new Promise<void>((resolve) => {
    const queue = queueRef.current;
    const hasActive = queue.some(
      (qi) => qi.status !== "done" && qi.status !== "failed",
    );

    // 没有活跃项且不在播放中 → 立即 resolve
    if (!hasActive && !playingRef.current) {
      resolve();
      return;
    }

    // 否则：把 resolve 加入等待队列
    waitersRef.current.push(resolve);

    // 30s 超时兜底（防止 audio.onended 永不触发）
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
```

`waitForIdle` 依赖 `stop` 而非 `state`。因为 `stop` 是空依赖的 `useCallback`，引用稳定。如果依赖 `state`（在播放过程中频繁变化），会导致 `useEffect` 反复触发造成死循环。

### 4c. 单段 TTS 失败处理

```
片段失败 → 自动重试（最多 2 次，300ms/800ms 递增退避）
    │
    ├─ 重试成功 → 正常进入 ready → 播放
    │
    └─ 重试耗尽 → stopAllAfterFailure()
                     │
                     ├─ 停止当前音频
                     ├─ 取消所有 pending fetch (AbortController)
                     ├─ 标记其余片段为 failed
                     ├─ setState("error")
                     ├─ onSegmentError() → 字幕展示全文 + toast 提示
                     └─ resolveWaiters() → waitForIdle() 返回
```

`onSegmentError` 回调在 VoiceInterview 中：
```typescript
onSegmentError: () => {
  setSubtitleLoading(false);
  setSubtitle(fullContentRef.current); // 直接展示本轮全部文本
  setAppState("waiting_for_user");     // 录音按钮立即可用
  toast.warning("语音合成失败，请查看文字继续回答");
},
```

### 4d. 面试结束

```typescript
// VoiceInterview.tsx:105
const finishInterview = useCallback(async () => {
  if (!interviewId || finishing) return;
  stopTTS();          // ★ 立即停止 TTS 队列
  setFinishing(true);
  // 调用 finish API → 跳转报告页
  const res = await fetch(`/api/interviews/${interviewId}/finish`, ...);
  router.push(`/results/${interviewId}`);
}, [interviewId, finishing, router, stopTTS]);
```

### 4e. 组件卸载

```typescript
// VoiceInterview.tsx:68
useEffect(() => {
  stopTTSRef.current = stopTTS;
}, [stopTTS]);

useEffect(() => {
  return () => {
    abortRef.current?.abort();  // 取消 pending SSE 请求
    stopTTSRef.current();       // 停止 TTS 队列
  };
}, []);
```

### 4f. stop() — 队列清空

```typescript
// useTTS.ts:375
const stop = useCallback(() => {
  generationRef.current += 1;    // ★ 递增 generation，使所有异步操作失效
  const gen = generationRef.current;

  // 停止当前音频
  if (currentAudioRef.current) {
    currentAudioRef.current.pause();
    currentAudioRef.current = null;
  }
  playingRef.current = false;

  // 取消所有 pending fetch
  abortAll(gen);

  // 清空队列
  queueRef.current = [];
  setState("idle");
  setQueueSize(0);
  resolveWaiters();
}, []);
```

**generation 机制：** 每次 `stop()` 都递增 `generationRef`。所有异步函数（`synthesizeItem`、`scheduleWork`、`playNextReady`）在执行关键操作前都检查 `gen !== generationRef.current`，如果 generation 已过期则直接返回。这避免了 stop 后旧请求的回调意外修改状态。

---

## 时序图

```
时间 →  0ms        500ms       1s         1.5s       2s         3s
        │          │          │           │          │          │
DeepSeek │ chu1 chu2 │ chu3 chu4 │ done       │          │          │
         │          │          │           │          │          │
分句器   │ buf...   │ seg1     │ seg2 seg3 │ flush    │          │
         │          │          │           │          │          │
TTS队列   │          │ enq(1)  │ enq(2,3)  │          │          │
         │          │ synth(1)│ synth(2,3)│          │          │
         │          │          │           │ ready(2) │ ready(1) │ ready(3)
         │          │          │           │          │ play(1)  │ play(2)
         │          │          │           │          │          │
字幕     │       "正在组织问题..."       │          │ "seg1"   │ "seg1seg2"
         │          │          │           │          │          │
音频     │          │          │           │          │ ▶️ seg1  │ ▶️ seg2
         │          │          │           │          │          │
UI状态   │processing│ ai_speaking (thinking/loading 动效)        │waiting_for_user
```

### 延迟指标

| 指标 | 典型时间 | 含义 |
|------|----------|------|
| `firstTokenMs` | ~500ms | DeepSeek 首个 chunk 到达 |
| `firstAudioReadyMs` | ~1.8s | 首个片段 TTS 合成完成（含分句入队时间） |
| `firstPlaybackMs` | ~2.0s | 浏览器开始播放首段音频 |
| `totalSpeakMs` | ~5s | 全部音频播放完毕 |

---

## 状态映射

### appState 变化

```
idle → processing           用户开始录音识别
processing → ai_speaking    首个片段入队
ai_speaking → waiting_for_user  TTS 队列全部结束（或失败）
waiting_for_user → user_speaking  用户点击录音按钮
user_speaking → processing  用户停止录音
processing → waiting_for_user   ASR 未识别到语音
```

### 头像状态

| 条件 | 状态 |
|------|------|
| `!loaded` | `thinking` |
| `ttsState === "playing"` | `speaking` |
| `ttsState === "loading"` 或 `queueSize > 0` | `thinking`（等待动效） |
| `appState === "ai_speaking"` | `thinking` |
| `appState === "user_speaking"` | `listening` |
| `appState === "processing"` | `thinking` |
| 其他 | `idle` |

### 字幕状态

| 条件 | 字幕栏显示 |
|------|-----------|
| `subtitleLoading && !subtitle` | "正在组织问题..." + 跳动圆点动效 |
| `subtitle` 非空 + `loading=true` | 已有字幕文字（无动效） |
| `subtitle` 非空 + TTS 播放中 | 流式追加的文本（带 fadeIn 动画） |
| `appState === "waiting_for_user"` | 完整 AI 回复文字 |
| 用户开始录音 | 隐藏 |

---

## 分句器详解

### 核心参数

```typescript
const DEFAULT_SEGMENT_POLICY = {
  minChars: 10,                          // 最短片段长度
  targetChars: 28,                       // 目标片段长度
  maxChars: 48,                          // 最长片段长度（强制切分）
  hardPunctuation: /[。！？!?；;\n]/,    // 强标点：到达 minChars 就切
  softPunctuation: /[，,、：:]/,         // 弱标点：到达 targetChars 才切
};
```

### 分句规则

| 条件 | 行为 |
|------|------|
| 遇到强标点 + 长度 ≥ `minChars` | 立即输出片段 |
| 遇到弱标点 + 长度 ≥ `targetChars` | 立即输出片段 |
| buffer 达到 `maxChars` | 强制切出前 `maxChars` 个字符 |
| `flush()` 调用 | 输出剩余文本（即使短于 `minChars`） |
| 空白字符 chunk | 不产生片段 |

### 示例

```
输入: chunk1="你好，" chunk2="请介绍一下你的项目。" chunk3="首先我" ... done

chunk1 "你好，"        → buffer="你好，"        → 弱标点但 3 < 10 → 不输出
chunk2 "请介绍一下..."  → buffer="你好，请介绍..." → "。" 强标点且 13 ≥ 10 → 输出 "你好，请介绍..."
chunk3 "首先我"        → buffer="首先我"         → 不输出
...
flush()                → 输出 "首先我..."
```

---

## 浏览器兼容性

### AudioContext 解锁

Safari 和 Firefox 要求首次 `Audio.play()` 必须在用户手势的微任务链内触发。语音面试的第一个可用手势是"点击录音按钮"。

```typescript
// VoiceInterview.tsx:240
const handleStartRecording = useCallback(() => {
  // 在用户手势内创建并解锁 AudioContext
  const unlock = new AudioContext();
  unlock.resume().then(() => unlock.close()).catch(() => {});
  // 之后所有 TTS 播放不再受浏览器 autoplay 策略限制
  ...
}, [startListening]);
```

### HTTP 并发考虑

`prefetchLimit = 3` 意味着最多 4 个并发 `/api/tts` 请求（1 个播放中 + 3 个预合成中）。浏览器对同一域名的 HTTP/1.1 并发连接限制为 6，4 个请求在安全范围内。HTTP/2+ 下无此限制。

---

## 关键设计约束

1. **`/api/chat` SSE 协议不变。** 分句器工作在客户端，对 DeepSeek 流式输出格式无要求。
2. **`/api/tts` 请求/响应格式不变。** 队列只是并发调用已有 API，不依赖服务端流式音频接口。
3. **字幕 ≠ DeepSeek chunk。** 字幕只能在 `onSegmentReady` 中追加，确保展示的是"已可听的文字"而非"正在生成的文字"。
4. **音频不重叠。** `playingRef.current` 确保同一时刻只有一个 `<audio>` 在播放。
5. **字幕不乱序。** `flushReadySubtitles` 的"连续 ready"约束保证即使后续片段先合成完成，字幕也不跳跃。
6. **日志不含敏感内容。** 延迟打点只记录长度、段数、时间差，不记录 AI 回复文本或用户回答。
7. **TTS 失败不阻断面试。** 重试耗尽后字幕展示全文，用户可正常录音回答。
