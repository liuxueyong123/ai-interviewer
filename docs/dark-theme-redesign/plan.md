# Dark Glass Theme Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign entire app from light to dark glassmorphism theme with violet accent

**Architecture:** Centralized Tailwind v4 `@theme inline` tokens in `globals.css` — all components reference tokens (e.g. `bg-surface-1`, `text-text-primary`). Token values change once, then each component gets glassmorphism enhancements (backdrop-blur, glow shadows).

**Tech Stack:** Next.js 16, Tailwind CSS v4, TypeScript, React

**Spec:** `docs/dark-theme-redesign/spec.md`

---

### Task 1: Replace Design Tokens in globals.css

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace all `@theme inline` color tokens and html/body styles**

Replace the entire `@theme inline` block and `html`/`body`/`scrollbar` styles in `src/app/globals.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
@import "tailwindcss";

@theme inline {
  --font-sans: "DM Sans", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
  --color-surface-0: #0c0f18;
  --color-surface-1: rgba(255, 255, 255, 0.03);
  --color-surface-2: rgba(255, 255, 255, 0.06);
  --color-surface-3: rgba(255, 255, 255, 0.09);
  --color-text-primary: #f1f5f9;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #64748b;
  --color-accent: #8b5cf6;
  --color-accent-hover: #7c3aed;
  --color-accent-muted: rgba(139, 92, 246, 0.12);
  --color-border: rgba(255, 255, 255, 0.08);
  --color-border-light: rgba(255, 255, 255, 0.04);
  --color-danger: #ef4444;
  --color-danger-muted: rgba(239, 68, 68, 0.10);
}

* { box-sizing: border-box; }

html {
  background: linear-gradient(135deg, #0c0f18 0%, #1a1040 40%, #0c0f18 100%);
  color: #f1f5f9;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  min-height: 100vh;
  background: linear-gradient(135deg, #0c0f18 0%, #1a1040 40%, #0c0f18 100%);
  font-family: var(--font-sans);
}

button, a, select, [role="button"], input[type="file"] { cursor: pointer; }
button:disabled, a[aria-disabled="true"] { cursor: not-allowed; }

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.animate-fade-in-up {
  animation: fadeInUp 0.4s ease-out both;
}

.animate-pulse-dot {
  animation: pulse-dot 2s ease-in-out infinite;
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/lxy/Documents/meeting && npx tsc --noEmit --pretty false 2>&1 | head -20`
Expected: No errors (may show existing type issues unrelated to this change)

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: replace design tokens with dark glass theme values"
```

---

### Task 2: Update Root Layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Update body classes for dark theme**

Change the `<body>` className in `src/app/layout.tsx:14` from:
```tsx
<body className="min-h-screen bg-surface-0 text-text-primary font-sans">
```
To:
```tsx
<body className="min-h-screen text-text-primary font-sans">
```

The background gradient is now on `html`/`body` in CSS, so `bg-surface-0` on body is removed (it would paint a solid color over the gradient).

- [ ] **Step 2: Verify build**

Run: `cd /Users/lxy/Documents/meeting && npx tsc --noEmit --pretty false 2>&1 | head -10`

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: dark theme body styles for root layout"
```

---

### Task 3: Update Button Component

**Files:**
- Modify: `src/components/Button.tsx`

- [ ] **Step 1: Add violet glow shadow to button**

Change the className in `src/components/Button.tsx:9`:

Old:
```tsx
className={`w-full py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover active:scale-[0.98] disabled:opacity-40 transition-all duration-200 cursor-pointer font-display ${className}`}
```

New:
```tsx
className={`w-full py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover active:scale-[0.98] disabled:opacity-40 transition-all duration-200 cursor-pointer font-display shadow-[0_4px_20px_rgba(139,92,246,0.25)] hover:shadow-[0_6px_28px_rgba(139,92,246,0.35)] ${className}`}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Button.tsx
git commit -m "feat: add violet glow to Button component"
```

---

### Task 4: Update NavBar Component

**Files:**
- Modify: `src/components/layout/NavBar.tsx`

- [ ] **Step 1: Change navbar to dark glass style**

Change the `<nav>` className at line 51 from:
```tsx
<nav className="border-b border-border bg-surface-1">
```
To:
```tsx
<nav className="border-b border-white/5 bg-surface-1 backdrop-blur-md">
```

Change the active link class at line 63 from `text-accent bg-accent-muted` to:
```tsx
pathname.startsWith(l.href) ? "text-accent bg-accent-muted shadow-[0_0_12px_rgba(139,92,246,0.1)]" : ...
```

Change the dropdown panel at line 85 from `bg-surface-1 border border-border` to:
```tsx
className="absolute right-0 top-full mt-1 w-48 bg-surface-1 backdrop-blur-xl border border-white/8 rounded-xl shadow-2xl overflow-hidden z-50"
```

Change the dropdown divider at line 86 from `border-b border-border` to:
```tsx
className="px-4 py-3 border-b border-white/5"
```

Change the logout button at line 104 from `hover:bg-red-50 hover:text-danger` to:
```tsx
className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-red-500/10 hover:text-danger transition-colors duration-150 cursor-pointer disabled:opacity-50"
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/NavBar.tsx
git commit -m "feat: dark glass style for NavBar"
```

---

### Task 5: Update Login Page

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Update error alert and form card for dark theme**

Change the login card at line 51 from `bg-surface-1 border border-border rounded-2xl shadow-sm` to:
```tsx
className="bg-surface-1 backdrop-blur-xl border border-white/8 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden"
```

Change the error alert at line 86 from `bg-red-50 border border-red-200 text-red-600` to:
```tsx
className="bg-red-500/5 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 font-medium"
```

- [ ] **Step 2: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat: dark glass style for login page"
```

---

### Task 6: Update Register Page

**Files:**
- Modify: `src/app/register/page.tsx`

- [ ] **Step 1: Update error alert and form card**

Change the register card at line 51 from `bg-surface-1 border border-border rounded-2xl shadow-sm` to:
```tsx
className="bg-surface-1 backdrop-blur-xl border border-white/8 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden"
```

Change the error alert at line 105 from `bg-red-50 border border-red-200 text-red-600` to:
```tsx
className="bg-red-500/5 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 font-medium"
```

- [ ] **Step 2: Commit**

```bash
git add src/app/register/page.tsx
git commit -m "feat: dark glass style for register page"
```

---

### Task 7: Update Dashboard Page

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Update StatCard for dark glass style**

Change the StatCard className at line 39 from:
```tsx
className="bg-surface-1 border border-border rounded-2xl p-4 text-center shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
```
To:
```tsx
className="bg-surface-1 backdrop-blur-xl border border-white/6 rounded-2xl p-4 text-center shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_40px_rgba(139,92,246,0.08)] hover:-translate-y-0.5 transition-all duration-200"
```

- [ ] **Step 2: Update status badges for dark theme**

Change the "passed" badge at line 145 from `bg-green-50 text-green-700` to:
```tsx
className="inline-flex items-center gap-2 text-xs px-3 py-1.5 bg-green-500/10 text-green-400 rounded-full font-medium"
```

Change the "evaluating" badge at line 152 from `bg-amber-50 text-amber-600` to:
```tsx
className="inline-flex items-center gap-1.5 text-xs px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full font-medium"
```

Change the "ongoing" badge at line 157 from `bg-blue-50 text-blue-600` to:
```tsx
className="inline-flex items-center gap-1.5 text-xs px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full font-medium"
```

Also update the "ongoing" badge dot color at line 158 from `bg-blue-500` to `bg-blue-400`.

Update the score color classes at line 150 — change `text-amber-500` to `text-amber-400`.

- [ ] **Step 3: Update interview cards for dark glass**

Change the interview card link at line 134 from:
```tsx
className="flex items-center justify-between bg-surface-1 border border-border rounded-2xl p-5 hover:border-accent/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group animate-fade-in-up"
```
To:
```tsx
className="flex items-center justify-between bg-surface-1 backdrop-blur-xl border border-white/6 rounded-2xl p-5 hover:border-accent/30 hover:shadow-[0_8px_30px_rgba(139,92,246,0.08)] hover:-translate-y-0.5 transition-all duration-200 group animate-fade-in-up"
```

- [ ] **Step 4: Update empty state for dark theme**

Change the empty state icon container at line 106 from `bg-gradient-to-br from-accent-muted to-transparent border border-accent/20` to:
```tsx
className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-accent-muted to-transparent border border-white/6 flex items-center justify-center"
```

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: dark glass style for dashboard page"
```

---

### Task 8: Update Interview Setup Page

**Files:**
- Modify: `src/app/interview/setup/page.tsx`
- Modify: `src/components/interview/SetupForm.tsx`

- [ ] **Step 1: Update setup page wrapper**

Change the card at `src/app/interview/setup/page.tsx:10` from `bg-surface-1 border border-border rounded-2xl shadow-sm` to:
```tsx
className="bg-surface-1 backdrop-blur-xl border border-white/8 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden"
```

- [ ] **Step 2: Update SetupForm dropdown styles**

In `src/components/interview/SetupForm.tsx`, change the SelectPopover dropdown panel at line 40 from `bg-surface-1 border border-border` to:
```tsx
className="absolute z-50 mt-1 w-full bg-surface-1 backdrop-blur-xl border border-white/8 rounded-xl shadow-2xl overflow-hidden"
```

Change the position search dropdown panel at line 191 from `bg-surface-1 border border-border` to:
```tsx
className="absolute z-50 mt-1 w-full bg-surface-1 backdrop-blur-xl border border-white/8 rounded-xl shadow-2xl max-h-72 overflow-y-auto"
```

- [ ] **Step 3: Update error alert in SetupForm**

Change the error alert at line 331 from `bg-red-50 border border-red-200 text-red-600` to:
```tsx
className="bg-red-500/5 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 font-medium"
```

- [ ] **Step 4: Update "no resumes" empty state**

At line 232, change from `border border-border` to:
```tsx
className="text-center py-8 border border-white/8 rounded-xl"
```

- [ ] **Step 5: Update "back" link**

At line 338, change from `bg-surface-1 border border-border text-text-secondary rounded-xl hover:border-text-muted` to:
```tsx
className="block w-full text-center py-3 bg-surface-1 backdrop-blur-md border border-white/8 text-text-secondary rounded-xl hover:border-white/15 transition-all duration-200 font-display text-sm"
```

- [ ] **Step 6: Commit**

```bash
git add src/app/interview/setup/page.tsx src/components/interview/SetupForm.tsx
git commit -m "feat: dark glass style for interview setup page"
```

---

### Task 9: Update Resumes Page

**Files:**
- Modify: `src/app/resumes/page.tsx`

- [ ] **Step 1: Update upload card**

Change the upload card at line 118 from `bg-surface-1 border border-border rounded-2xl shadow-sm` to:
```tsx
className="bg-surface-1 backdrop-blur-xl border border-white/8 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden"
```

Change the upload zone at line 123 from `border-2 border-dashed border-border rounded-xl hover:border-accent hover:bg-accent-muted` to:
```tsx
className="w-full h-28 border-2 border-dashed border-white/8 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-accent/40 hover:bg-accent-muted transition-all duration-200"
```

- [ ] **Step 2: Update error alert**

Change the upload error at line 142 from `bg-red-50 border border-red-200 text-red-600` to:
```tsx
className="mt-3 bg-red-500/5 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-2.5 font-medium"
```

- [ ] **Step 3: Update empty state**

Change the empty state icon at line 151 from `bg-surface-2 border border-border` to:
```tsx
className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-2 border border-white/6 flex items-center justify-center"
```

- [ ] **Step 4: Update resume list items**

Change the resume card at line 169 from `bg-surface-1 border border-border rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-accent/30` to:
```tsx
className="flex items-center justify-between bg-surface-1 backdrop-blur-md border border-white/6 rounded-2xl p-5 shadow-sm hover:shadow-[0_8px_30px_rgba(139,92,246,0.06)] hover:border-accent/30 transition-all duration-200 cursor-pointer animate-fade-in-up"
```

Change the delete button at line 195 from `bg-red-50 text-red-600 rounded-lg hover:bg-red-100` to:
```tsx
className="text-xs px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all duration-200 font-medium cursor-pointer"
```

- [ ] **Step 5: Update modals**

Change the edit modal at line 210 from `bg-surface-1 border border-border` to:
```tsx
className="relative bg-surface-1 backdrop-blur-xl border border-white/8 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up"
```

Change the edit modal overlay at line 208 from `bg-black/30` to `bg-black/50`.

Change the delete modal at line 272 from `bg-surface-1 border border-border` to:
```tsx
className="relative bg-surface-1 backdrop-blur-xl border border-white/8 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up"
```

Change the delete modal overlay at line 271 from `bg-black/30` to `bg-black/50`.

- [ ] **Step 6: Commit**

```bash
git add src/app/resumes/page.tsx
git commit -m "feat: dark glass style for resumes page"
```

---

### Task 10: Update Settings Page

**Files:**
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Update settings cards with glass effect**

Change the profile card at line 108 and password card at line 179 from `bg-surface-1 border border-border rounded-2xl shadow-sm` to:
```tsx
className="bg-surface-1 backdrop-blur-xl border border-white/8 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden"
```

- [ ] **Step 2: Update error alerts**

Change the profile error at line 139 and password error at line 264 from `text-danger text-xs bg-red-50 rounded-lg` to:
```tsx
className="flex items-center gap-2 text-red-400 text-xs bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2.5 font-medium"
```

- [ ] **Step 3: Update success (done) button state**

Change the `profileDone` button style at line 152 and `passwordDone` at line 277 from `bg-green-50 text-green-600` to:
```tsx
className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer font-display bg-green-500/10 text-green-400 pointer-events-none"
```

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: dark glass style for settings page"
```

---

### Task 11: Update Results Page

**Files:**
- Modify: `src/app/results/[id]/page.tsx`

- [ ] **Step 1: Update evaluating state error/warning banners**

Change the warning banner at line 89 from `bg-amber-50 border border-amber-200` to:
```tsx
className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4"
```
And the warning text at line 90 from `text-amber-700` to `text-amber-400`.

- [ ] **Step 2: Update "not passed" banner**

Change the failed banner at line 181 from `bg-amber-50 border border-amber-200` to:
```tsx
className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 max-w-md mx-auto mb-4"
```
Change text at line 182 from `text-amber-800` to `text-amber-300`.
Change text at line 183 from `text-amber-700` to `text-amber-400`.

- [ ] **Step 3: Update evaluating timeout warning**

Change at line 120 from `bg-amber-50 border border-amber-200` to:
```tsx
className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 max-w-md mx-auto mt-6"
```
Change text at line 121 from `text-amber-700` to `text-amber-400`.

- [ ] **Step 4: Commit**

```bash
git add src/app/results/[id]/page.tsx
git commit -m "feat: dark theme alert banners for results page"
```

---

### Task 12: Update VoiceInterview Component

**Files:**
- Modify: `src/components/interview/VoiceInterview.tsx`

- [ ] **Step 1: Replace hardcoded colors with design tokens**

Change the split view AI panel at line 270 from `bg-slate-900/50 rounded-2xl border border-white/5` to:
```tsx
className="flex-1 bg-surface-1 backdrop-blur-md rounded-2xl flex flex-col border border-white/5 relative overflow-hidden"
```

Change the camera panel at line 284 from `bg-black/40 rounded-2xl border border-white/5` to:
```tsx
className="flex-1 bg-surface-1 backdrop-blur-md rounded-2xl flex flex-col border border-white/5 overflow-hidden"
```

Change the position text at line 250 from `text-slate-400` to `text-text-muted`:
```tsx
<span className="text-xs text-text-muted">AI 面试 · {position}</span>
```

Change the timer text at line 257 from `text-slate-500` to `text-text-muted`:
```tsx
<span className="text-xs text-text-muted tabular-nums font-mono">{formatElapsed(elapsedSeconds)}</span>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/interview/VoiceInterview.tsx
git commit -m "feat: use design tokens in VoiceInterview component"
```

---

### Task 13: Update Remaining Components

**Files:**
- Modify: `src/components/chat/ChatContainer.tsx`
- Modify: `src/components/chat/ChatHistory.tsx`
- Modify: `src/components/chat/roleConfig.tsx`
- Modify: `src/components/interview/ScoreCard.tsx`
- Modify: `src/components/interview/ProgressPanel.tsx`
- Modify: `src/components/interview/Steps.tsx`
- Modify: `src/components/results/EvaluatingSpinner.tsx`
- Modify: `src/components/ui/ErrorBoundary.tsx`
- Modify: `src/components/ui/Toast.tsx`

- [ ] **Step 1: Read and update each file**

Read each file listed above. Any hardcoded light-background colors (e.g. `bg-gray-50`, `bg-white`, `bg-red-50`, `bg-amber-50`, `bg-blue-50`) should be changed to dark equivalents:
- `bg-red-50` → `bg-red-500/5`
- `bg-amber-50` → `bg-amber-500/5`
- `bg-blue-50` → `bg-blue-500/10`
- `bg-green-50` → `bg-green-500/10`
- `text-red-600` → `text-red-400`
- `text-amber-600` → `text-amber-400`
- `border-red-200` → `border-red-500/20`
- `border-amber-200` → `border-amber-500/20`
- `bg-white` → `bg-surface-1`
- `bg-gray-50` → `bg-surface-0`

- [ ] **Step 2: Verify the full build**

Run: `cd /Users/lxy/Documents/meeting && npx tsc --noEmit --pretty false`

- [ ] **Step 3: Commit**

```bash
git add src/components/
git commit -m "feat: dark theme for remaining components"
```

---

### Final: Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Verify TypeScript build**

Run: `cd /Users/lxy/Documents/meeting && npx tsc --noEmit --pretty false`

- [ ] **Step 2: Verify Next.js build**

Run: `cd /Users/lxy/Documents/meeting && npm run build 2>&1 | tail -30`

- [ ] **Step 3: Summary commit if any remaining changes**

Run `git status` to check for uncommitted files. If any remain, commit them.
