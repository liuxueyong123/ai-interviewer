# Voice Interview Design Spec

**Date:** 2026-05-14
**Status:** Approved
**Architecture:** Approach A — Extend existing SSE chat + new TTS API

## Overview

Add a voice-based interview mode alongside the existing text chat mode. In voice mode, the AI interviewer speaks via DashScope Qwen3-TTS-VD (Chinese male voice), and the user responds by speaking. The UI simulates a video call with split-screen layout — AI avatar on the left, user's local camera on the right.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| TTS model | `qwen3-tts-vd-2026-01-26` (non-streaming HTTP) | User specified; voice-design model with custom male voice |
| Voice creation | One-time via `/api/v1/services/audio/tts/customization`, voice_id stored in env | VD model requires voice design first |
| Conversation flow | Manual push-to-talk | User clicks to start/stop recording, controls own pace |
| AI avatar | Abstract SVG geometric face with sound wave animation | No uncanny valley, pure CSS/SVG, professional |
| Subtitles | Yes — bottom overlay bar showing AI speech text | Accessibility, clarity in noisy environments |
| User camera | Local preview only via getUserMedia, never transmitted | Privacy; purely decorative video-call feel |
| Text mode TTS | Optional — speaker button on interviewer bubbles | Reuse same TTS hook, minimal effort |
| API strategy | Reuse existing `/api/chat` SSE + `/api/speech` ASR; add new `/api/tts` | Minimal backend changes, proven infrastructure |

## Interview Modes

### Text Mode (existing)
- Route: `/interview/chat?id=xxx`
- Chat bubbles with markdown rendering
- Optional voice input via microphone button
- **New:** optional speaker button on each interviewer bubble for TTS playback

### Voice Mode (new)
- Route: `/interview/voice?id=xxx`
- Split-screen "video call" UI, dark theme
- Full voice interaction: AI speaks → user listens → clicks to record → speaks → clicks done → ASR → AI responds
- Subtitles overlay at bottom
- Same interview data model, same chat API, same results page

## Component Tree

```
VoiceChatPage (/interview/voice)
└── VoiceInterview (state machine orchestrator)
    ├── TopBar
    │   ├── Interview info (position name)
    │   ├── Round indicator + timer
    │   └── End interview button
    ├── SplitView
    │   ├── AIAvatar (left panel)
    │   │   ├── SVG geometric face
    │   │   ├── Pulse ring animation (always)
    │   │   ├── Sound wave bars (when AI_SPEAKING)
    │   │   └── Status indicator dot + label
    │   └── CameraPreview (right panel)
    │       ├── <video> element with local stream
    │       └── "仅本地，不传输" privacy notice
    ├── SubtitleBar
    │   └── AI speech text, fade-in transition
    └── VoiceControls
        ├── Mute/unmute toggle
        └── Record button (start/stop)
```

## State Machine

```
                    ┌──────────────────────────────────┐
                    │                                  │
                    ▼                                  │
┌──────┐    ┌──────────────┐    ┌──────────────────┐   │
│ IDLE │───▶│ AI_SPEAKING  │───▶│ WAITING_FOR_USER │   │
└──────┘    └──────────────┘    └──────────────────┘   │
                  │                      │              │
                  │ TTS audio            │ User clicks   │
                  │ playing              │ "开始回答"     │
                  │                      ▼              │
                  │           ┌──────────────────┐      │
                  │           │ USER_SPEAKING    │      │
                  │           └──────────────────┘      │
                  │                      │              │
                  │                      │ User clicks   │
                  │                      │ "回答完毕"     │
                  │                      ▼              │
                  │           ┌──────────────────┐      │
                  └───────────│ PROCESSING       │──────┘
                              └──────────────────┘
                                   │
                                   │ ASR → Chat SSE → TTS
                                   │ (interview ended?)
                                   ▼
                              ┌──────────┐
                              │ FINISHED │──▶ redirect /results/[id]
                              └──────────┘
```

### State Details

| State | AIAvatar | Record Button | Subtitle | Notes |
|-------|----------|---------------|----------|-------|
| IDLE | Static face, slow pulse | Hidden/disabled | Empty | Initial load, loading history |
| AI_SPEAKING | Sound wave bars animating, green dot "正在说话" | Disabled (grey) | Showing AI text with fade-in | Audio element playing |
| WAITING_FOR_USER | Static face, slow pulse | Red pulsing circle, label "点击开始回答" | Last AI message retained | Waiting for user action |
| USER_SPEAKING | Listening indicator (subtle pulse) | Red square stop icon, label "点击结束回答" | "正在聆听..." | MediaRecorder active |
| PROCESSING | Thinking dots animation | Disabled (spinner) | "思考中..." | ASR → Chat → TTS pipeline |
| FINISHED | Static face | Hidden | "面试结束" | Interview complete |

### Transitions

```
IDLE → AI_SPEAKING:      First question loaded from history, TTS auto-plays
AI_SPEAKING → WAITING:   Audio.onended fires
WAITING → USER_SPEAKING: User clicks record button
USER_SPEAKING → PROCESSING: User clicks stop button
PROCESSING → AI_SPEAKING:  TTS audio ready, start playing
PROCESSING → FINISHED:     Chat API returns "面试环节已结束"
```

## Data Flow

### Voice Interview Loop

```
1. AI asks question via SSE stream → text accumulates
   POST /api/chat { interviewId, message }
   → SSE: { type: "chunk", content } ... { type: "done", questionNumber }

2. SSE done → TTS synthesis
   POST /api/tts { text: fullAiMessage }
   → { audio: "data:audio/wav;base64,..." }

3. Play audio → onended → state → WAITING_FOR_USER

4. User clicks record → MediaRecorder starts → state → USER_SPEAKING

5. User clicks stop → MediaRecorder.stop() → Blob → ASR
   POST /api/speech (FormData: audio blob)
   → { text: "user's answer" }

6. Send recognized text to chat API → loop to step 1
   POST /api/chat { interviewId, message: recognizedText }
```

### Edge Cases

- **ASR returns empty text:** Show toast "未识别到语音，请重试", return to WAITING_FOR_USER
- **ASR fails (network):** Show toast "语音识别失败", return to WAITING_FOR_USER
- **TTS fails:** Fall back to showing subtitle text only, skip to WAITING_FOR_USER
- **Chat API fails:** Show error toast, allow retry
- **User clicks "结束面试":** Call `/api/interviews/:id/finish`, redirect to results
- **Browser tab hidden during playback:** Pause/resume audio appropriately
- **Mobile autoplay policy:** First user gesture (clicking "开始面试" on setup) unlocks AudioContext; subsequent TTS plays work

## New/Modified Files

| Action | File | Purpose |
|--------|------|---------|
| **New** | `src/app/api/tts/route.ts` | TTS endpoint: text → DashScope Qwen3-TTS-VD → base64 audio |
| **New** | `src/hooks/useTTS.ts` | Hook: `{ speak, stop, state }` manages fetch + Audio playback |
| **New** | `src/app/interview/voice/page.tsx` | Voice interview page (Suspense wrapper) |
| **New** | `src/components/interview/VoiceInterview.tsx` | State machine orchestrator |
| **New** | `src/components/interview/AIAvatar.tsx` | SVG abstract face + animations |
| **New** | `src/components/interview/CameraPreview.tsx` | Local getUserMedia video element |
| **New** | `src/components/interview/SubtitleBar.tsx` | Animated subtitle text display |
| **New** | `src/components/interview/VoiceControls.tsx` | Record button + mute + end call |
| **New** | `scripts/create-voice.ts` | One-time script: voice design → get voice_id |
| **Modify** | `src/components/interview/SetupForm.tsx` | Add mode selector (text/voice), route accordingly |
| **Modify** | `src/entities/Interview.ts` | Add `mode` column (`text` / `voice`), default `text` for existing rows |
| **Modify** | `src/app/api/interviews/route.ts` | Accept `mode` in POST body |
| **Modify** | `src/components/chat/ChatContainer.tsx` | Optional: add TTS speaker button on interviewer bubbles |
| **Modify** | `CLAUDE.md` | Document new env var `DASHSCOPE_TTS_VOICE_ID` |

## TTS API Design

### Voice Creation (one-time setup)

```
POST https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization
{
  "model": "qwen-voice-design",
  "input": {
    "action": "create",
    "voice_prompt": "温暖沉稳的中年男声，语速适中，专业且有亲和力，适合面试场景",
    "preview_text": "同学你好，欢迎参加今天的面试，请先简单介绍一下自己。",
    "target_model": "qwen3-tts-vd-2026-01-26",
    "preferred_name": "interviewer_male"
  },
  "parameters": { "sample_rate": 24000, "response_format": "wav" }
}
→ { output: { voice_id: "xxx" } }
```

Store `voice_id` as `DASHSCOPE_TTS_VOICE_ID` env var.

### TTS Synthesis (per-request)

```
POST /api/tts
Authorization: (via cookie → x-user-id)
Body: { "text": "请介绍一下你的项目经验" }

→ Internal call:
POST https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
{
  "model": "qwen3-tts-vd-2026-01-26",
  "input": {
    "text": "请介绍一下你的项目经验",
    "voice": "<DASHSCOPE_TTS_VOICE_ID>",
    "language_type": "Chinese"
  }
}

→ Response: { "audio": "data:audio/wav;base64,AAAA..." }
```

### Error Handling

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Not logged in | 401 | `{ error: "未登录" }` |
| Text too long (>600 chars) | 400 | `{ error: "文本过长" }` |
| DashScope API error | 502 | `{ error: "语音合成失败" }` |
| voice_id not configured | 500 | `{ error: "TTS 未配置" }` |

## useTTS Hook

```typescript
type TTSState = "idle" | "loading" | "playing" | "error";

interface UseTTSReturn {
  speak: (text: string) => Promise<void>;
  stop: () => void;
  state: TTSState;
}

function useTTS(): UseTTSReturn
```

- `speak(text)`: POST `/api/tts` → decode base64 → `new Audio(dataUri)` → play → resolve on `ended`
- `stop()`: Pause + reset current audio
- Aborts previous request if `speak` called again while loading/playing
- Auto-cleanup on unmount

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DASHSCOPE_TTS_VOICE_ID` | Yes (voice mode) | Custom voice ID from voice design step |
| `DASHSCOPE_API_KEY` | Yes (already exists) | DashScope API key (shared with ASR) |

## Risks & Mitigations

| Risk | Level | Mitigation |
|------|-------|------------|
| Browser autoplay policy blocks audio | High | First gesture (setup page "开始面试") unlocks AudioContext for session |
| TTS latency (1-3s per request) | Medium | Show "思考中..." animation during PROCESSING; feels natural as interviewer "thinking" |
| Echo: speaker audio picked up by mic | Medium | Use `echoCancellation: true` in getUserMedia constraints |
| ASR + TTS voice quality mismatch | Low | Both use DashScope; consistent audio quality |
| Mobile camera permission denied | Low | CameraPreview shows placeholder if getUserMedia fails |

## Testing Strategy

- **Unit:** useTTS hook (mock fetch + Audio), state machine transitions, AIAvatar render states
- **Integration:** TTS API endpoint (mock DashScope response), voice interview page load + history
- **E2E:** Text mode TTS button → audio plays; mode selector → routes correctly
- **Manual:** Voice creation script, end-to-end voice interview flow, mobile browser testing
