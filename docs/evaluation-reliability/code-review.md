# Evaluation Reliability Code Review

Date: 2026-05-29

Scope: Review of changes made for `docs/evaluation-reliability/spec.md` and `docs/evaluation-reliability/plan.md`.

## Findings

### Critical: Missing production database migration

`src/entities/Interview.ts` adds the `evaluation_failed` status and four evaluation metadata columns:

- `evaluation_started_at`
- `evaluation_finished_at`
- `evaluation_error`
- `evaluation_attempts`

Production does not auto-sync TypeORM schema because `src/lib/database.ts` uses `synchronize: !isProduction`. Without a migration or manual SQL, production requests can fail when `finish` updates the new columns or writes the new enum value.

Evidence:

- `src/entities/Interview.ts`
- `src/lib/database.ts`
- `README.md` notes that production schema sync is disabled.

Expected fix:

- Add a TypeORM migration or documented SQL migration.
- Ensure deployment applies the migration before the new code starts handling requests.

### Important: Results API does not return evaluation failure metadata

`src/hooks/useResultsPolling.ts` and `src/app/results/[id]/page.tsx` expect `interview.evaluationError`, but `GET /api/interviews/[id]` does not include `evaluationError` or `evaluationAttempts` in its response body.

Impact:

- The failure UI cannot display the persisted server-side failure reason.
- The frontend/server contract is inconsistent with the spec.

Evidence:

- `src/app/api/interviews/[id]/route.ts`
- `src/hooks/useResultsPolling.ts`
- `src/app/results/[id]/page.tsx`

Expected fix:

- Include `evaluationError` and `evaluationAttempts` in `GET /api/interviews/[id]`.

### Important: Core evaluation service lacks regression tests

`src/lib/__tests__/evaluationService.test.ts` currently only tests `isEvaluationStale`. The plan requires coverage for `runRoundEvaluation`, including success, failure, retry, stale evaluation, score threshold, and old-evaluation deletion behavior.

Impact:

- The most important state transitions are not protected by tests.
- Regressions could silently reintroduce stuck `evaluating` interviews.

Evidence:

- `src/lib/__tests__/evaluationService.test.ts`
- `src/lib/evaluationService.ts`

Expected fix:

- Add mocked repository/model tests for `runRoundEvaluation`.
- Cover at least:
  - successful save of current-round `Evaluation`;
  - passed-with-more-rounds -> `passed`;
  - last round -> `done`;
  - below threshold -> `done`;
  - aggregate parse failure -> `evaluation_failed`;
  - model failure -> `evaluation_failed`;
  - retry deletes old current-round evaluation;
  - failure persists `evaluationError`;
  - retry increments attempts through the route or a tested orchestration path.

### Important: `evaluation_failed` can still accept chat messages

`src/app/api/chat/route.ts` only blocks `done` and `passed`. It does not block `evaluating` or `evaluation_failed`.

Impact:

- A user or script can post more chat messages after evaluation has started or failed.
- A later retry may evaluate changed conversation content instead of the failed snapshot.

Evidence:

- `src/app/api/chat/route.ts`
- `src/components/chat/ChatContainer.tsx`
- `src/components/interview/VoiceInterview.tsx`

Expected fix:

- Reject chat writes when status is `evaluating` or `evaluation_failed`.
- Treat `evaluation_failed` as a terminal/non-chat state in chat and voice clients.

### Important: Lint fails, including issues introduced by the changed files

`pnpm lint` fails. Some failures are pre-existing, but the changed files also trigger lint errors:

- `src/app/results/[id]/page.tsx`: `react-hooks/set-state-in-effect`
- `src/hooks/useResultsPolling.ts`: `react-hooks/set-state-in-effect`

Impact:

- CI will fail if lint is required.
- The code is not clean under the project's current Next.js 16 / React 19 lint rules.

Expected fix:

- Refactor initial selected-round derivation and initial polling trigger to satisfy the React hooks lint rule.
- Separately decide whether existing unrelated lint failures should be fixed or excluded.

## Verification Performed

Commands run:

```bash
pnpm test src/lib/__tests__/evaluationParsers.test.ts src/lib/__tests__/evaluationService.test.ts
pnpm lint
pnpm build
```

Results:

- Targeted tests passed: 2 files, 25 tests.
- `pnpm lint` failed.
- `pnpm build` failed in sandbox due to Turbopack process/port permission limits.
- `pnpm build` passed when rerun outside the sandbox with approval.

Build warning:

- Turbopack reported an NFT tracing warning involving `next.config.ts`, `src/lib/pdf.ts`, and `src/app/api/resumes/route.ts`.
