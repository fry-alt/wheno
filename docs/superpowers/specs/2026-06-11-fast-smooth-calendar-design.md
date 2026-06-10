# Fast & smooth calendar (perf + motion + polish) — design

**Date:** 2026-06-11
**Status:** approved (brainstorm)
**Feature:** Make the calendar *feel* instant and smooth — kill the navigation lag, add restrained CSS motion, and polish the interactive surfaces. One combined cycle (optimization + animations + design are inseparable here).

## Goal

The user asked for animations, a beautiful design, and "optimize so everything is fast with no delays." The dominant delay: the calendar is `force-dynamic`, and every view switch / prev-next / year→month does `router.push`, which makes the App Router show the **global full-screen `app/loading.tsx`** ("Загружаем wheno") during the server fetch — a jarring full-screen flash on every interaction. Fixing that unlocks smooth motion. So the three asks become one: a snappy, smooth, polished calendar.

## Scope

In scope:
- **Perceived performance:** wrap calendar navigation in `useTransition` so the current view stays on screen during navigation (no full-screen loader flash), with a subtle pending indicator. A calendar-shaped skeleton `loading.tsx` for cold loads. Token-restyle the existing loaders.
- **Animations (CSS-only, subtle, ~150–250ms):** view/period enter transition, agenda list stagger, bottom-sheet slide-up, tap feedback, `prefers-reduced-motion` support.
- **Design polish:** extract a shared `BottomSheet` primitive (DRY the sheets + grabber/consistent chrome), tidy the FAB cluster, minor spacing/typography.

Out of scope (deferred):
- Friends / notes / capture-form internals beyond sheet chrome.
- Adjacent-range prefetch / data caching (YAGNI — `useTransition` already removes the flash).
- Animation libraries (framer-motion) — CSS-only, zero new bundle weight.
- Exit animations for sheets (enter-only; closing stays instant).

## Decisions (locked during brainstorm)

| Question | Decision |
|---|---|
| Scope | **One combined cycle** ("fast & smooth calendar"). |
| Motion style | **Subtle, premium** (~150–250ms cross-fade/slide). |
| Tech | **CSS-only** (Tailwind + `@keyframes` in `globals.css`), no new deps. |
| Nav lag fix | **`useTransition`** around `router.push` (suppresses the loading fallback). |

## 1. Perceived performance

### `useTransition` navigation
In `CalendarScreen`:
```
const [isPending, startTransition] = useTransition();
function pushView(nextView, nextDate) {
  startTransition(() => router.push(`/calendar?view=${nextView}&date=${nextDate}`));
}
```
All nav (view switch, ±month/week/year, year→month) routes through `pushView`. Inside a transition, the App Router keeps the **current** UI mounted instead of rendering the nearest `loading.tsx`, so there's no full-screen flash; the new server render swaps in when ready.

### Pending indicator
While `isPending`: a 2px accent bar fixed at the top (`animate` shimmer/indeterminate via CSS) + the view container at `opacity-60 pointer-events-none`. Communicates "loading" without blanking.

### Loaders
- New `src/app/(app)/calendar/loading.tsx` — a lightweight skeleton matching the calendar layout (switcher bar, grid placeholder, a few row placeholders) on token surfaces. Only shows on cold load / refresh (in-app nav uses the transition).
- Restyle `src/app/loading.tsx` and `src/components/loading-state.tsx` from hardcoded `#0f0f0f`/hex to tokens (`bg-background`, `text-foreground/muted`).

## 2. Animations (CSS-only)

Add to `globals.css` (with a reduced-motion guard):
```css
@keyframes fadeRise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes slideUp  { from { transform: translateY(100%); }          to { transform: translateY(0); } }
@keyframes fadeIn   { from { opacity: 0; }                            to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; }
}
```
Applied via Tailwind arbitrary utilities (`animate-[fadeRise_200ms_ease-out]`, etc.):
- **View/period transition:** the active view container is keyed `key={`${view}-${anchor}`}` in `CalendarScreen` so it remounts and runs `fadeRise` on change.
- **Agenda stagger:** each `EventRow` (month) / day-section (week) gets `fadeRise` with inline `style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}`.
- **Bottom sheets:** backdrop `fadeIn`, panel `slideUp` (~250ms).
- **Tap feedback:** `active:scale-[0.97] transition` on FABs, segmented options, rows, sheet buttons (fill gaps where missing).

## 3. Design polish

### `BottomSheet` primitive — `src/components/ui/bottom-sheet.tsx`
Encapsulates the repeated sheet chrome: fixed inset backdrop (`fadeIn`, click-to-close) + bottom panel (`slideUp`, `bg-card-strong`, top border, rounded-t-2xl, a centered grabber handle). Props: `{ onClose, children, className? }`. Adopted by `CaptureSheet` and `AdvisorSheet` (replaces their duplicated wrapper markup). `ScopeDialog` (centered) keeps its layout but gets `fadeIn`.

### FAB cluster
`✨` and `+` (currently `bottom-44`/`bottom-24`) unified on tokens (`bg-card-strong` / `bg-accent`), consistent size/shadow, `active:scale-95`.

## Architecture / files

| File | Change |
|---|---|
| `src/app/globals.css` | + keyframes (`fadeRise/slideUp/fadeIn`) + reduced-motion guard + pending-bar keyframe |
| `src/components/ui/bottom-sheet.tsx` | **new** — sheet primitive |
| `src/components/calendar/calendar-screen.tsx` | `useTransition` nav, `isPending` indicator, keyed view container, FAB polish |
| `src/components/calendar/month-view.tsx` | agenda `fadeRise` stagger |
| `src/components/calendar/week-view.tsx` | day-section `fadeRise` stagger |
| `src/components/calendar/year-view.tsx` | mini-month `fadeRise` (light stagger) |
| `src/components/capture/capture-sheet.tsx` | adopt `BottomSheet` |
| `src/components/advisor/advisor-sheet.tsx` | adopt `BottomSheet` |
| `src/components/calendar/scope-dialog.tsx` | `fadeIn` backdrop |
| `src/app/(app)/calendar/loading.tsx` | **new** — calendar skeleton |
| `src/app/loading.tsx`, `src/components/loading-state.tsx` | token restyle |

## Testing
- No new pure logic → no new unit tests. Verification = `npx tsc --noEmit`, `npm run lint`, `npm run build`, and live screenshots/feel (run/verify). The existing **63 tests must stay green**.
- Acceptance: switching views / ±nav no longer flashes the full-screen loader (current view stays, subtle pending bar); views fade-rise in; agenda rows stagger; sheets slide up; reduced-motion disables animations; cold load shows the calendar skeleton.

## Risks
- **`useTransition` suppressing `loading.tsx`:** documented App Router behavior; confirm visually. If a route-level `loading.tsx` ever overrides it, rely on the transition keeping the current tree.
- **Animation jank on low-end devices:** keep transforms/opacity only (GPU-friendly), short durations, `prefers-reduced-motion` honored.
- **Bundle:** zero new dependencies.

## Provider note
No LLM/provider changes; purely UI/UX.
