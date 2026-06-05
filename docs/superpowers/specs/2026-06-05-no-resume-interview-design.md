# No-Resume Interview Mode Design

**Date:** 2026-06-05
**Status:** Approved for planning

## Goal

Let users start an interview without selecting or uploading a resume. If the user has resumes, the setup page still selects the first resume by default, but clicking the selected resume again clears the selection and starts a no-resume interview.

## Scope

This feature includes:

- Removing the hard requirement for a selected resume on the interview setup page.
- Keeping the first saved resume selected by default when available.
- Allowing a selected resume card to be clicked again to clear selection.
- Creating an interview with empty `resumeText` when no resume is selected.
- Adapting interview prompts when `resumeText.trim()` is empty.
- Hiding resume suggestion UI for no-resume interviews.
- Keeping text interview, voice interview, question count, rounds, and difficulty behavior unchanged.

This feature does not include:

- A new database field such as `contextMode`.
- A dedicated no-resume interview API.
- Manual background fields such as skills, experience years, or project summaries.
- A "job-seeking expression suggestions" replacement section.
- Database migrations.

## Current System Context

The current interview setup flow is resume-first:

- `src/components/interview/SetupForm.tsx` loads saved resumes from `GET /api/resumes`.
- If exactly one resume exists, the setup form currently selects it.
- `handleStart()` currently blocks start when `selectedResumeId` is empty.
- The start button is disabled unless both `position` and `selectedResumeId` are present.
- `POST /api/interviews` accepts `resumeText` and `resumeId`, but returns `400` when the final resume text is empty.
- `Interview.resumeText` is a non-null `text` column, so empty string is the simplest no-migration representation for no-resume interviews.
- `buildInterviewSystemMessage()` always includes a "候选人简历" section.
- Evaluation aggregation always asks the model for `resumeSuggestions`.

## Product Behavior

### Setup Page

The setup page keeps one unified flow.

When saved resumes exist:

- Select the first resume by default.
- Show resume cards as selectable.
- If the user clicks an unselected resume, select it.
- If the user clicks the currently selected resume, clear the selection.
- When no resume is selected, the page indicates the interview will start without a resume.

When no saved resumes exist:

- Do not block interview start.
- Show a lightweight empty state explaining that uploading a resume is optional.
- Keep a link to `/resumes` for users who want resume-based interview questions.

The "开始面试" button requires only a selected position. It must not require a resume.

### Interview Creation API

`POST /api/interviews` continues to use the existing request shape:

```json
{
  "position": "前端开发工程师",
  "questionCount": 12,
  "maxRounds": 2,
  "difficulty": "mid",
  "mode": "text",
  "resumeId": 1
}
```

For no-resume interviews, the client omits `resumeId`:

```json
{
  "position": "前端开发工程师",
  "questionCount": 12,
  "maxRounds": 2,
  "difficulty": "mid",
  "mode": "text"
}
```

Server behavior:

- If `resumeId` is present, load the resume and use its `content`.
- If `resumeId` is absent and `resumeText` is absent or blank, create the interview with `resumeText: ""`.
- Keep ownership checks for `resumeId`.
- Keep `prevInterviewId` behavior unchanged. A restarted interview should inherit the previous interview's `resumeText`, including empty string.

### Opening Message

For resume interviews, keep the current opening style.

For no-resume interviews, create the first interviewer message without implying a resume was provided:

```text
同学你好，很高兴见到你。我是今天{{position}}岗位的面试官。我们会围绕岗位能力、项目经历和综合素质进行交流。请先简单介绍一下自己，以及你和这个岗位相关的经历。
```

### Interview Prompt

`buildInterviewSystemMessage()` uses `resumeText.trim()` to branch.

When resume text exists:

- Keep the existing resume-based prompt.
- Include the "候选人简历" section.
- Ask the interviewer to combine resume details and target position.

When resume text is empty:

- Do not include a "候选人简历" section.
- Tell the interviewer that the candidate did not provide a resume.
- Ask the interviewer to build context through the candidate's self-introduction and answers.
- Questions should cover role fundamentals, scenario judgment, project experience, communication, and problem solving.
- The interviewer should not say "根据你的简历" or refer to missing resume details.

The existing voice-mode rule still applies: voice prompts return plain text without Markdown.

### Evaluation

Per-question scoring remains unchanged.

Aggregation should branch on `resumeText.trim()`:

When resume text exists, keep the current output contract:

```json
{
  "overallScore": 80,
  "categories": {
    "tech": 80,
    "project": 75,
    "softSkills": 85
  },
  "strengths": "string",
  "weaknesses": "string",
  "resumeSuggestions": "string",
  "practiceSuggestions": []
}
```

When resume text is empty, do not ask the model for `resumeSuggestions`:

```json
{
  "overallScore": 80,
  "categories": {
    "tech": 80,
    "project": 75,
    "softSkills": 85
  },
  "strengths": "string",
  "weaknesses": "string",
  "practiceSuggestions": []
}
```

The API can store `resumeSuggestions: ""` for no-resume interviews to preserve the existing database shape.

### Results UI

The results page should hide the resume suggestion section when no resume was used.

The condition should be based on interview data already returned by `GET /api/interviews/[id]`:

- If `interview.resumeText.trim()` has content, show the current resume suggestion section.
- If `interview.resumeText.trim()` is empty, hide the section completely.

No replacement section is added.

## Architecture

This design treats no-resume interview as the absence of resume content, not a separate interview type. The boundary is intentionally small:

- UI controls whether `resumeId` is present.
- API persists empty `resumeText` when no resume is selected.
- Prompt and evaluation helpers branch from `resumeText.trim()`.
- Results UI hides resume-only content when `resumeText` is empty.

This avoids a migration and keeps all existing mode, round, scoring, and dashboard behavior intact.

## Data Model

No schema changes.

Existing `Interview.resumeText` remains `text` and stores:

- Parsed resume content for resume interviews.
- Empty string for no-resume interviews.

## Files To Change

- `src/components/interview/SetupForm.tsx`
  - Default-select first resume when available.
  - Toggle selected resume off on repeated click.
  - Remove resume requirement from validation and button disabled state.
  - Send `resumeId` only when a resume is selected.
  - Adjust empty-state copy to make resumes optional.

- `src/app/api/interviews/route.ts`
  - Allow empty `finalResumeText`.
  - Create the interview with `resumeText: finalResumeText`.
  - Use a no-resume opening message when `finalResumeText.trim()` is empty.

- `src/lib/deepseek.ts`
  - Branch `buildInterviewSystemMessage()` by `resumeText.trim()`.
  - Branch `buildAggregationMessage()` by `resumeText.trim()`.
  - Ensure no-resume prompts do not mention nonexistent resume content.

- `src/app/results/[id]/page.tsx`
  - Derive whether the selected interview has resume content.
  - Pass that state into the evaluation text component for completed and partially completed result views.

- `src/components/interview/EvaluationText.tsx`
  - Add a `showResumeSuggestions` boolean prop.
  - Hide the resume suggestion block when `showResumeSuggestions` is false.
  - Keep the current "简历优化建议" block for resume-based interviews.

- `src/components/interview/ScoreCard.tsx`
  - Pass `showResumeSuggestions={true}` so the existing wrapper keeps resume-based behavior.

- Tests in the existing Vitest structure
  - Add setup form tests for default selection, deselection, and no-resume start.
  - Add interview creation API tests for omitted `resumeId`.
  - Add prompt/evaluation helper tests for no-resume branching.
  - Add results page test or focused component coverage for hiding resume suggestions.

## Error Handling

- Missing position still returns the existing "请选择目标岗位" validation error.
- Invalid or unauthorized `resumeId` still returns "简历不存在".
- No resume selected is not an error.
- Empty `resumeText` is allowed only as no-resume content; blank user-provided resume text should not be surfaced as a separate UI path in this feature.

## Testing Plan

Unit and integration tests should cover:

- Setup form starts with the first saved resume selected when resumes exist.
- Clicking the selected resume clears selection.
- Start button is enabled when a position exists and no resume is selected.
- The setup form posts without `resumeId` when no resume is selected.
- `POST /api/interviews` creates an interview with `resumeText: ""` when `resumeId` is omitted.
- `POST /api/interviews` still rejects nonexistent or unauthorized `resumeId`.
- No-resume system prompt omits the "候选人简历" section.
- No-resume system prompt asks the interviewer to establish context through self-introduction and answers.
- No-resume aggregation prompt omits `resumeSuggestions`.
- Resume-based aggregation prompt still includes `resumeSuggestions`.
- Results UI hides resume suggestions for empty `resumeText`.
- Existing resume-based setup and interview creation behavior still works.

Verification commands:

```bash
pnpm test
pnpm lint
pnpm build
```

## Acceptance Criteria

- A user can start an interview after selecting only a target position.
- If resumes exist, the first resume is selected by default.
- Clicking the selected resume again clears it.
- No-resume interviews work in both text and voice modes.
- No-resume prompts do not reference a provided resume.
- Resume-based interviews keep current behavior.
- No-resume result reports do not show resume suggestions or replacement advice sections.
- The change requires no database migration.
