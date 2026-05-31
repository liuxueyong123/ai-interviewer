# 流式 TTS 降低语音面试等待时间规格说明

**日期：** 2026-05-31
**状态：** 草案
**范围：** 仅优化语音面试中 AI 面试官回复到语音播放的等待时间

## 背景问题

当前语音面试已经使用 DeepSeek SSE 流式输出，但前端仍然等到完整回复结束后，才把 `fullContent` 一次性交给 `useTTS().speak(fullContent)`。`useTTS` 也只支持一次请求、一次播放。

因此用户听到 AI 面试官开口前，需要等待完整链路：

1. DeepSeek 生成完整回答。
2. `/api/tts` 合成整段回答。
3. 浏览器加载音频并开始播放。

这会让“面试官输出”在长回答或网络波动时出现明显卡顿。目标是改成：DeepSeek 边输出，前端边切句，TTS 边合成，音频边排队播放。

## 目标

- AI 回复的第一段文本可用后立即进入 TTS，而不是等待完整回复。
- 保持现有 `/api/chat` SSE 协议不变。
- 第一阶段继续复用现有 `/api/tts`，不强依赖 TTS 厂商音频级流式接口。
- 音频严格按文本顺序播放，不重叠、不乱序。
- 当前片段播放时，后台预合成后续片段，减少段与段之间的空白。
- 单个 TTS 片段失败后自动重试，达到上限后停止全部后续合成与播放。
- 字幕按“已合成完成的片段”流式展示，不直接展示尚未合成的 DeepSeek 原始 chunk。
- AI 等待合成时有明确动效，避免用户误以为页面卡住。
- 分句逻辑可单独单元测试，不依赖 React 或浏览器 API。
- 增加延迟打点，能衡量首 token、首段入队、首音频就绪、首播放时间。

## 非目标

- 不替换 DeepSeek 模型。
- 不改造 ASR 语音识别流程。
- 不重做语音面试 UI。
- 不改变 `/api/chat` 保存最终面试官消息的行为。
- 不在本阶段接入真正的 TTS WebSocket 音频流。

## 当前流程

```text
VoiceInterview.sendToChat()
  -> POST /api/chat
  -> 读取 SSE chunk 并拼接 fullContent
  -> 等待 done
  -> pendingSubtitleRef.current = fullContent
  -> speak(fullContent)
  -> 等待整段音频播放结束
  -> appState = waiting_for_user
```

## 目标流程

```text
VoiceInterview.sendToChat()
  -> POST /api/chat
  -> 读取 SSE chunk
  -> 拼接 fullContent
  -> chunk 进入文本分句器
  -> 每个可播放片段 enqueue 到 TTS 队列
  -> 第一段音频就绪后立即播放
  -> 后续片段继续合成并按顺序播放
  -> SSE done 后 flush 分句器尾句
  -> 等待 TTS 队列播放结束
  -> appState = waiting_for_user
```

## 方案架构

### 1. 流式文本分句器

新增 `src/lib/streamingTextSegmenter.ts`。

职责：

- 接收 DeepSeek 增量文本 chunk。
- 在内部维护未播放 buffer。
- 根据标点和长度输出适合 TTS 的文本片段。
- 在 SSE 结束时 flush 剩余尾句。
- 避免过短片段导致 TTS 频繁请求和听感割裂。

默认策略：

```typescript
const DEFAULT_SEGMENT_POLICY = {
  minChars: 10,
  targetChars: 28,
  maxChars: 48,
  hardPunctuation: /[。！？!?；;\n]/,
  softPunctuation: /[，,、：:]/,
};
```

分句规则：

- 遇到强停顿标点，且候选片段长度不少于 `minChars`，立即输出。
- 遇到弱停顿标点，且候选片段长度不少于 `targetChars`，立即输出。
- buffer 达到 `maxChars` 时强制输出，避免首段等待过久。
- 如果达到 `maxChars` 仍没有合适边界，直接输出前 `maxChars` 个字符。
- `flush()` 时输出剩余文本，即使短于 `minChars`。
- 输出片段保留末尾标点。

### 2. TTS 队列 Hook

改造 `src/hooks/useTTS.ts`，从单次 `speak()` 改成队列式 API。

公开接口：

```typescript
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

export interface UseTTSReturn {
  state: TTSQueueState;
  currentText: string;
  queueSize: number;
  metrics: TTSMetrics;
  enqueue: (text: string) => void;
  waitForIdle: () => Promise<void>;
  getMetricsSnapshot: () => TTSMetrics;
  resetMetrics: () => void;
  stop: () => void;
}
```

队列行为：

- `enqueue(text)` 把文本片段加入播放队列。
- 队列一次只播放一个音频，确保无重叠。
- 队列支持预合成：当前片段播放时，后台最多预合成 `prefetchLimit` 个后续片段。默认 `prefetchLimit = 3`。
- 预合成只提前获取音频，不提前播放；播放顺序仍由队列顺序决定。
- 同一片段 TTS 请求失败后自动重试，默认最多重试 2 次，重试间隔使用 300ms、800ms 递增退避。
- 达到重试上限后触发 `onSegmentError`，**立即停止全部后续片段的合成和播放**，记录 `failedCount`，并通过回调通知调用方展示全文回退字幕。
- `stop()` 清空队列、停止当前音频、取消进行中的 fetch，并让旧请求结果失效。
- `waitForIdle()` 在所有片段播放或失败后 resolve。内置 30 秒超时兜底，超时后强制 resolve 并清空队列。
- `getMetricsSnapshot()` 返回最新指标快照，避免异步回调读到 React 旧闭包。
- `onSegmentReady(text)` 在片段音频合成完成后触发，用于展示该片段字幕。**重要：** 预合成允许后续片段先于队首片段 ready，此时 `onSegmentReady` 不立即触发，而是缓存 ready 状态。只有从队首开始连续 ready 的片段才会按序触发回调，确保字幕严格按文本顺序展示。
- `onSegmentStart(text)` 在片段开始播放时触发，用于更新头像和播放状态。

### 3. VoiceInterview 集成

修改 `src/components/interview/VoiceInterview.tsx`。

关键变化：

- 每次 `sendToChat()` 创建一个新的分句器实例。
- 每收到一个 SSE `chunk`，立即：
  - 拼接到 `fullContent`；
  - 推入分句器；
  - 将分句器输出的片段 `enqueue()` 到 TTS 队列。
- 第一个片段入队后，将 `appState` 切到 `ai_speaking`。
- 字幕不跟随 DeepSeek 原始 chunk 展示；只有 TTS 片段合成完成并触发 `onSegmentReady(text)` 后，才把该片段追加到字幕。
- 在已有片段入队但首段尚未 ready 时，字幕区域显示“正在组织问题...”或等效等待动效。
- SSE `done` 时调用 `segmenter.flush()`，将尾句入队。
- 等待 `waitForIdle()` 后再切到 `waiting_for_user`。
- 如果最终文本包含“面试环节已结束”，先播放结束语，再调用 `finishInterview()`。

### 4. 延迟打点

每轮 AI 回复记录这些时间点：

- `chatRequestStartedAt`：发起 `/api/chat` 时间。
- `firstDeepSeekChunkAt`：收到第一个 DeepSeek chunk 时间。
- `firstSegmentEnqueuedAt`：第一个 TTS 片段入队时间。
- `firstAudioReadyAt`：第一个音频合成完成时间。
- `firstPlaybackStartedAt`：浏览器实际开始播放时间。
- `ttsQueueIdleAt`：TTS 队列全部结束时间。

日志字段：

```typescript
console.info("voice_turn_latency", {
  interviewId,
  chars: fullContent.length,
  segments: metrics.enqueuedCount,
  retries: metrics.retriedCount,
  failedSegments: metrics.failedCount,
  firstTokenMs,
  firstSegmentMs,
  firstAudioReadyMs,
  firstPlaybackMs,
  totalSpeakMs,
});
```

日志禁止包含候选人回答、简历文本、完整 AI 回复等敏感内容。

## 状态机影响

沿用现有状态机：

- `processing`：用户回答正在识别或发送。
- `ai_speaking`：AI 至少已有一个片段入队、合成中或播放中。
- `waiting_for_user`：SSE 已结束，TTS 队列也已结束。

头像状态映射：

```text
tts loading -> thinking + 等待动效
tts playing -> speaking
appState ai_speaking 且 queueSize > 0 -> thinking + 等待动效
appState ai_speaking 且 tts idle 且 queueSize = 0 -> idle
```

字幕状态：

- `processing`：显示“正在识别/思考”的现有提示。
- `ai_speaking` 且首个片段尚未合成完成：显示等待动效文案，例如“正在组织问题...”。
- 每个片段触发 `onSegmentReady(text)` 后，将该片段追加到字幕中。
- 用户开始录音后隐藏 AI 字幕，避免遮挡用户回答状态。

## 异常处理

| 场景                                 | 行为                                                 |
| ------------------------------------ | ---------------------------------------------------- |
| 分句器输出空字符串                   | 丢弃                                                 |
| 单个 TTS 片段失败                    | 自动重试，默认最多 2 次                              |
| 单个 TTS 片段重试后仍失败            | 停止全部后续 TTS 合成与播放，toast 提示"语音合成失败"，字幕直接展示当前轮次的全部文本，用户可正常录音回答 |
| 首个片段就失败（无任何音频播放）      | toast 提示"语音合成失败"，字幕展示全部文本，用户可正常录音回答 |
| `/api/chat` 在任何片段入队前失败     | toast 报错，回到 `waiting_for_user`                  |
| `/api/chat` 在已经播放部分语音后失败 | 停止队列，toast 报错，回到 `waiting_for_user`        |
| 用户中途结束面试                     | 停止 TTS 队列，abort chat 请求，调用 finish endpoint |
| 组件卸载                             | abort chat 请求并停止 TTS 队列                       |

## 浏览器自动播放策略

现代浏览器（尤其是 Safari 和 Firefox）会拦截非用户手势触发的 `Audio.play()`，导致 TTS 音频无声。应对方案：

- 首个 `Audio` 实例的 `play()` 必须在用户手势的微任务链内触发。语音面试的首个用户手势是**点击“开始录音”按钮**或**授权麦克风**，这之后创建的 AudioContext / Audio 元素可以正常播放。
- 如果首个片段在用户手势之前就已合成完成（例如初始加载历史消息时自动播放），此时 `play()` 可能被浏览器拦截。需要在播放失败时降级为显示“点击播放”按钮，或者确保历史消息场景下也先有一个用户交互。
- 后续片段的 `play()` 可以复用已解锁的音频上下文，不受限制。
- 不要在页面加载时预创建 `Audio` 元素——等到用户首次交互后再初始化 TTS 队列。

## 单段 TTS 失败后的处理

TTS 片段在重试上限内仍失败时，**不继续播放后续片段**，而是执行以下恢复流程：

1. `useTTS` 内部：停止队列中所有未播放片段（清空 queued、取消进行中的 fetch、已 ready 但未播放的音频丢弃）。
2. 通过 `onSegmentError` 回调通知 `VoiceInterview`。
3. `VoiceInterview` 收到回调后：
   - Toast 提示用户"语音合成失败，请查看文字继续回答"。
   - 字幕区域**直接展示当前轮次的全部文本**（`fullContent`），不再逐段追加。
   - `appState` 切到 `waiting_for_user`，录音按钮立即可用。
4. 用户像正常文字面试一样，阅读字幕文字后点击录音回答。

这样确保：即使 TTS 失败，面试流程不被阻断，用户始终可以继续。

## 字幕展示策略

多段 TTS 场景下，字幕区域需要处理文本累积：

- 字幕按 `onSegmentReady` 触发的顺序追加。`onSegmentReady` 保证严格按文本顺序触发（队首连续 ready 后才依次回调，即使后续片段先合成完成也不会跳跃触发）。
- 形成完整文本。
- 字幕区域设置 `max-height`，内容超出后 `overflow-y: auto`，并自动 `scrollToBottom`。
- 用户开始录音后隐藏字幕（现有行为保持）。
- 新一轮 AI 回复开始时清空上一轮字幕。

## HTTP 并发考虑

`prefetchLimit = 3` 意味着最多同时进行 4 个 `/api/tts` 请求（1 个播放中的 + 3 个预取中的）。浏览器对同一域名的 HTTP/1.1 并发连接限制为 6 个，4 个请求在安全范围内。HTTP/2+ 下无此限制。不需要额外配置。

## 测试要求

### 分句器单元测试

新增 `src/lib/__tests__/streamingTextSegmenter.test.ts`，覆盖：

- 强标点达到最小长度后输出。
- 弱标点达到目标长度后输出。
- 很短的弱标点片段不输出。
- 超长无标点文本按 `maxChars` 切分。
- `flush()` 输出最终短尾句。
- 标点在后续 chunk 才到达时仍能正确输出。
- 空白 chunk 不产生片段。

### TTS Hook 测试

新增 `src/hooks/__tests__/useTTS.test.ts`，覆盖：

- `enqueue()` 调用 `/api/tts` 并播放音频。
- 多个片段按顺序播放。
- 当前片段播放时会预合成后续片段。
- 单个片段重试失败后停止全部后续 TTS，触发 `onSegmentError`。
- `waitForIdle()` 在队列结束后 resolve。
- `stop()` 取消 pending 请求并阻止旧音频继续播放。
- 超过重试上限后增加 `failedCount`，并停止全部后续 TTS。
- `resetMetrics()` 清空本轮指标。
- `getMetricsSnapshot()` 返回最新指标。
- `onSegmentReady()` 只在音频合成完成后触发。

### 集成测试

如果当前项目暂不具备 React 组件测试基础，先通过分句器和 Hook 单元测试覆盖核心行为。后续可以抽出 `VoiceInterview` 的 SSE 事件处理 helper，再对“chunk -> segment -> enqueue”的编排做单元测试。

## 上线步骤

1. 先合入分句器和队列式 TTS hook。
2. 再改造 `VoiceInterview` 的 SSE 读取逻辑。
3. 保留 `/api/chat` 和 `/api/tts` 接口不变，降低回归风险。
4. 用 `firstPlaybackMs` 对比优化前后的首播放耗时。
5. 根据真实面试文本微调 `minChars`、`targetChars`、`maxChars`。

## 成功标准

- 多句 AI 回复时，首段语音能在完整 DeepSeek 回复结束前开始播放。
- 普通中文面试问题通常在首句或 28-48 个字符后开始 TTS。
- 当前音频播放时，下一段音频能提前合成，段间空白明显减少。
- 音频无重叠、无乱序。
- 单段 TTS 重试失败后停止全部后续 TTS，toast 提示用户，字幕展示全文。
- 字幕按已合成片段流式展示，等待首段合成时有动效。
- 文字面试模式不受影响。
- `pnpm test`、`pnpm lint`、`pnpm build` 均通过。
