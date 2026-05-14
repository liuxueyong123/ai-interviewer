# Dark Glass Theme Redesign

**Date:** 2026-05-14
**Status:** Approved
**Style:** Glassmorphism Dark + Violet accent

## Overview

Complete theme redesign from light to dark. All components and pages use updated design tokens.
Strategy: replace `@theme inline` variables in `globals.css`, then enhance key components with glassmorphism effects.

## Design System

### Style
- **Name:** Glassmorphism Dark
- **Accent:** Violet `#8b5cf6` / hover `#7c3aed`
- **Background:** Deep gradient `#0c0f18 → #1a1040 → #0c0f18`
- **Panels:** Semi-transparent white + `backdrop-blur`

### Typography
- Keep existing: Space Grotesk (headings) + DM Sans (body)

### Design Tokens

| Token | Old (Light) | New (Dark Glass) |
|-------|-------------|-------------------|
| `--color-surface-0` | `#f8fafc` | `#0c0f18` |
| `--color-surface-1` | `#ffffff` | `rgba(255,255,255,0.03)` |
| `--color-surface-2` | `#f1f5f9` | `rgba(255,255,255,0.06)` |
| `--color-surface-3` | `#e2e8f0` | `rgba(255,255,255,0.09)` |
| `--color-text-primary` | `#0f172a` | `#f1f5f9` |
| `--color-text-secondary` | `#475569` | `#94a3b8` |
| `--color-text-muted` | `#94a3b8` | `#64748b` |
| `--color-accent` | `#22c55e` | `#8b5cf6` |
| `--color-accent-hover` | `#16a34a` | `#7c3aed` |
| `--color-accent-muted` | `rgba(34,197,94,0.08)` | `rgba(139,92,246,0.12)` |
| `--color-border` | `#e2e8f0` | `rgba(255,255,255,0.08)` |
| `--color-border-light` | `#f1f5f9` | `rgba(255,255,255,0.04)` |
| `--color-danger` | `#ef4444` | `#ef4444` (unchanged) |
| `--color-danger-muted` | `rgba(239,68,68,0.06)` | `rgba(239,68,68,0.10)` |

## Page Background

`html` / `body`:
```
background: linear-gradient(135deg, #0c0f18 0%, #1a1040 40%, #0c0f18 100%)
color: #f1f5f9
```

Scrollbar: `#334155` thumb on transparent track.

## Component Changes

### All surface-1 panels
- Add `backdrop-blur-xl` to `bg-surface-1` elements
- Deeper shadow: `shadow-[0_20px_50px_rgba(0,0,0,0.3)]`

### NavBar
- Background: `bg-surface-1 backdrop-blur-md border-b border-white/5`
- Active link: accent glow

### Button
- Accent color → violet
- Add glow: `shadow-[0_4px_20px_rgba(139,92,246,0.25)]`

### Status Badges
- All badges: semi-transparent dark bg + bright text
- ongoing: `bg-blue-500/10 text-blue-400`
- evaluating: `bg-amber-500/10 text-amber-400`
- passed: `bg-green-500/10 text-green-400`
- failed: `bg-red-500/10 text-red-400`

### Error/Warning alerts
- error: `bg-red-500/5 border-red-500/20 text-red-400`
- warning: `bg-amber-500/5 border-amber-500/20 text-amber-400`

### Inputs
- bg: `surface-0`, border: `white/8`
- focus: `ring-accent/30 border-accent`

### Modals
- Overlay: `bg-black/50`
- Panel: glass effect with backdrop-blur

### Select/Dropdown
- Dark background with accent highlight for selected

### Voice Interview
- Replace hardcoded colors with design tokens
- Keep hex grid background on AI panel

## Page-Level Changes

### Login / Register
- Card: glass + gradient accent bar at top

### Dashboard
- StatCard: glass panels with backdrop-blur
- Interview cards: hover with accent border glow
- Empty state: dark-adapted colors

### Interview Setup
- Position search: dark dropdown with accent selection
- Mode selector: accent border on selected
- Resume selection: accent border on selected

### Resumes
- Upload zone: dark dashed border + hover accent
- List items: glass panels
- Delete confirm: dark modal

### Settings
- Cards: glass panels
- Password strength bar: keep colors

### Results
- EvaluatingSpinner: works on dark bg
- ScoreRing/CategoryBars: keep colors, dark background
- Steps: dark-adapted
- Failed/completed banners: dark-adapted amber/green

### Chat (Text Interview)
- Messages: dark bubble colors

## Implementation Order

1. `globals.css` — replace all `@theme inline` tokens
2. `app/layout.tsx` — update body classes
3. `components/Button.tsx` — violet accent + glow
4. `components/layout/NavBar.tsx` — dark glass navbar
5. `app/login/page.tsx` — badge/error dark colors
6. `app/register/page.tsx` — badge/error dark colors
7. `app/dashboard/page.tsx` — status badges, stat cards
8. `app/interview/setup/page.tsx` + `SetupForm.tsx` — dark form
9. `app/resumes/page.tsx` — dark upload and list
10. `app/settings/page.tsx` — dark panels
11. `app/results/[id]/page.tsx` — dark results
12. `components/interview/VoiceInterview.tsx` — token references
13. Remaining components — adapt any hardcoded colors

## Not Changed
- Fonts (Space Grotesk + DM Sans)
- Layout structure
- Component logic/behavior
- ScoreRing/CategoryBars chart colors
- Voice interview hex grid background
- Logo "InterviewAI" name
