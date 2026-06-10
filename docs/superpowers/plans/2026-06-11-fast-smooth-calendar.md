# Fast & Smooth Calendar (perf + motion + polish) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. This cycle is UI/CSS + one React behavior (`useTransition`); there is no new pure logic, so no new unit tests — verify with `tsc`/`lint`/`build` and live screenshots, and keep the existing 63 tests green.

**Goal:** Make the calendar feel instant and smooth — remove the full-screen loader flash on navigation (`useTransition`), add restrained CSS motion, and polish the sheets/FABs.

**Architecture:** Calendar nav (`router.push`) is wrapped in `useTransition` so the current view stays mounted (no `loading.tsx` flash) with a subtle pending bar. CSS `@keyframes` in `globals.css` drive view enter-transitions, agenda stagger, and bottom-sheet slide-up; a shared `BottomSheet` primitive DRYs the sheet chrome. `prefers-reduced-motion` disables motion. Zero new dependencies.

**Tech Stack:** Next.js 16 App Router (`useTransition`), React 19, Tailwind v4 + CSS keyframes, date-fns. No animation library.

**Spec:** `docs/superpowers/specs/2026-06-11-fast-smooth-calendar-design.md`

---

## File structure

**New:**
- `src/components/ui/bottom-sheet.tsx` — backdrop + slide-up panel + grabber.
- `src/app/(app)/calendar/loading.tsx` — calendar skeleton (cold-load fallback).

**Modified:**
- `src/app/globals.css` — keyframes + reduced-motion guard.
- `src/components/calendar/calendar-screen.tsx` — `useTransition` nav, pending bar, keyed/animated view container, FAB polish.
- `src/components/calendar/month-view.tsx`, `week-view.tsx`, `year-view.tsx` — list stagger.
- `src/components/capture/capture-sheet.tsx`, `src/components/advisor/advisor-sheet.tsx` — adopt `BottomSheet`.
- `src/components/calendar/scope-dialog.tsx` — token restyle + slide/fade.
- `src/app/loading.tsx` — token background.

**Verify per task:** `npx tsc --noEmit` + `npx eslint <files>`; build at checkpoints. No test files change.

---

## Task 1: Motion keyframes + reduced-motion guard

**Files:** Modify `src/app/globals.css`

- [ ] **Step 1: Append** to the end of `src/app/globals.css`:

```css
/* ─── Motion ─────────────────────────────────────────────────────────────── */
@keyframes fadeRise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes slideUp  { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes fadeIn   { from { opacity: 0; } to { opacity: 1; } }
@keyframes barSlide { 0% { transform: translateX(-120%); } 100% { transform: translateX(420%); } }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
```

- [ ] **Step 2: Verify build** — `npm run build`. Expected: succeeds (CSS compiles).

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: motion keyframes + reduced-motion guard"
```

---

## Task 2: `BottomSheet` primitive

**Files:** Create `src/components/ui/bottom-sheet.tsx`

- [ ] **Step 1: Implement**:

```tsx
"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";

export function BottomSheet({
  onClose,
  children,
  className,
}: {
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 animate-[fadeIn_150ms_ease-out]" onClick={onClose}>
      <div
        className={clsx(
          "absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-card-strong p-5 pb-10",
          "animate-[slideUp_250ms_cubic-bezier(0.22,1,0.36,1)]",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint** — `npx tsc --noEmit && npx eslint src/components/ui/bottom-sheet.tsx`. Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/bottom-sheet.tsx
git commit -m "feat: BottomSheet primitive (backdrop + slide-up + grabber)"
```

---

## Task 3: `useTransition` navigation + pending bar + animated view container

**Files:** Modify `src/components/calendar/calendar-screen.tsx`

- [ ] **Step 1: Update imports** — change the React import and add `clsx`:

```tsx
import { useMemo, useState, useTransition } from "react";
```
and add near the other imports:
```tsx
import { clsx } from "clsx";
```

- [ ] **Step 2: Add the transition hook** — right after `const router = useRouter();` add:

```tsx
const [isPending, startTransition] = useTransition();
```

- [ ] **Step 3: Wrap navigation** — replace the `pushView` function with:

```tsx
function pushView(nextView: CalendarView, nextDate: string) {
  startTransition(() => router.push(`/calendar?view=${nextView}&date=${nextDate}`));
}
```

- [ ] **Step 4: Pending bar + keyed/animated view container + FAB polish** — replace the JSX block from `<ViewSwitcher ... />` through the three `{view === ... }` renders with:

```tsx
{isPending && (
  <div className="fixed inset-x-0 top-0 z-40 h-0.5 overflow-hidden bg-transparent">
    <span className="block h-full w-1/4 rounded-full bg-accent animate-[barSlide_0.9s_ease-in-out_infinite]" />
  </div>
)}

<ViewSwitcher value={view} onChange={switchView} />

<div
  key={`${view}-${anchor}`}
  className={clsx(
    "animate-[fadeRise_200ms_ease-out]",
    isPending && "pointer-events-none opacity-60 transition-opacity",
  )}
>
  {view === "month" && (
    <MonthView
      dayNotes={dayNotes}
      timezone={timezone}
      anchorMonth={anchor.slice(0, 7)}
      selectedDate={selectedDate}
      daysWithEvents={daysWithEvents}
      dayEvents={dayEvents}
      onSelectDate={setSelectedDate}
      onNavigateMonth={navigateMonth}
      onEventClick={onEventClick}
    />
  )}
  {view === "week" && (
    <WeekView
      anchor={anchor}
      events={events}
      timezone={timezone}
      todayStr={todayStr}
      onNavigateWeek={navigateWeek}
      onEventClick={onEventClick}
    />
  )}
  {view === "year" && (
    <YearView
      year={Number(anchor.slice(0, 4))}
      currentMonth={currentMonthStr}
      onSelectMonth={selectMonth}
      onNavigateYear={navigateYear}
    />
  )}
</div>
```

- [ ] **Step 5: FAB tap feedback** — add `transition active:scale-95` to both FAB buttons' classNames (the `✨` and `+` buttons), e.g. append ` transition active:scale-95` before the closing quote of each `className`.

- [ ] **Step 6: Typecheck + lint + build** — `npx tsc --noEmit && npx eslint src/components/calendar/calendar-screen.tsx && npm run build`. Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/calendar/calendar-screen.tsx
git commit -m "feat: useTransition calendar nav (no loader flash) + pending bar + view enter anim"
```

---

## Task 4: Agenda/list stagger in the views

**Files:** Modify `src/components/calendar/month-view.tsx`, `week-view.tsx`, `year-view.tsx`

- [ ] **Step 1: month-view** — wrap each agenda `EventRow` in an animated div. Replace:

```tsx
          dayEvents.map((e) => <EventRow key={e.id} event={e} timezone={timezone} onClick={() => onEventClick(e)} />)
```
with:
```tsx
          dayEvents.map((e, i) => (
            <div
              key={e.id}
              className="animate-[fadeRise_200ms_ease-out] [animation-fill-mode:backwards]"
              style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
            >
              <EventRow event={e} timezone={timezone} onClick={() => onEventClick(e)} />
            </div>
          ))
```

- [ ] **Step 2: week-view** — add the enter animation to each day section. Change the section wrapper:

```tsx
        {days.map((day) => {
```
so the returned `<div key={key}>` becomes (find the `return (<div key={key}>` and add className/style, threading the map index):

```tsx
        {days.map((day, i) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = byDay.get(key) ?? [];
          const isToday = key === todayStr;
          return (
            <div
              key={key}
              className="animate-[fadeRise_200ms_ease-out] [animation-fill-mode:backwards]"
              style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
            >
```
(keep the rest of the section body unchanged; the existing closing `</div>` for the section still matches.)

- [ ] **Step 3: year-view** — add a light stagger to the mini-month buttons. Change the map to thread index and add animation to the `<button>`:

```tsx
        {MONTH_NAMES.map((name, i) => {
          const monthStr = `${year}-${String(i + 1).padStart(2, "0")}`;
          const isCurrent = monthStr === currentMonth;
          return (
            <button
              key={monthStr}
              onClick={() => onSelectMonth(monthStr)}
              style={{ animationDelay: `${i * 20}ms` }}
              className={clsx(
                "animate-[fadeRise_200ms_ease-out] [animation-fill-mode:backwards] rounded-2xl border bg-card p-2 text-left transition active:scale-[0.98]",
                isCurrent ? "border-accent" : "border-border",
              )}
            >
```
(`clsx` is already imported in year-view.tsx.)

- [ ] **Step 4: Typecheck + lint** — `npx tsc --noEmit && npx eslint src/components/calendar/month-view.tsx src/components/calendar/week-view.tsx src/components/calendar/year-view.tsx`. Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/month-view.tsx src/components/calendar/week-view.tsx src/components/calendar/year-view.tsx
git commit -m "feat: staggered fade-rise for agenda lists + year grid"
```

---

## Task 5: Adopt `BottomSheet` in capture + advisor sheets

**Files:** Modify `src/components/capture/capture-sheet.tsx`, `src/components/advisor/advisor-sheet.tsx`

- [ ] **Step 1: capture-sheet** — import the primitive and replace the outer wrapper. Add import:

```tsx
import { BottomSheet } from "@/components/ui/bottom-sheet";
```
Replace the return wrapper:
```tsx
  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
      <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl border-t border-border bg-card-strong p-5 pb-10" onClick={(e) => e.stopPropagation()}>
```
with:
```tsx
  return (
    <BottomSheet onClose={onClose}>
```
and change the matching closing tags at the end of the component:
```tsx
      </div>
    </div>
  );
```
to:
```tsx
    </BottomSheet>
  );
```

- [ ] **Step 2: advisor-sheet** — import the primitive and swap the wrapper. Add import:

```tsx
import { BottomSheet } from "@/components/ui/bottom-sheet";
```
Replace:
```tsx
  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
      <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-[#111] p-5 pb-10" onClick={(e) => e.stopPropagation()}>
```
with:
```tsx
  return (
    <BottomSheet onClose={onClose}>
```
and the matching closing tags at the end:
```tsx
      </div>
    </div>
  );
```
with:
```tsx
    </BottomSheet>
  );
```

- [ ] **Step 3: Typecheck + lint + build** — `npx tsc --noEmit && npm run lint && npm run build`. Expected: clean (pre-existing `<img>` warnings only). The advisor sheet's inner hardcoded hex stays (dark, acceptable); only its chrome changed.

- [ ] **Step 4: Commit**

```bash
git add src/components/capture/capture-sheet.tsx src/components/advisor/advisor-sheet.tsx
git commit -m "feat: capture + advisor sheets on shared BottomSheet (slide-up)"
```

---

## Task 6: Scope dialog restyle + loaders

**Files:** Modify `src/components/calendar/scope-dialog.tsx`, `src/app/loading.tsx`; Create `src/app/(app)/calendar/loading.tsx`

- [ ] **Step 1: scope-dialog** — token restyle + animation. Replace the whole return:

```tsx
  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/60 animate-[fadeIn_150ms_ease-out]" onClick={onCancel}>
      <div className="w-full rounded-t-2xl border-t border-border bg-card-strong p-5 pb-10 animate-[slideUp_250ms_cubic-bezier(0.22,1,0.36,1)]" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <p className="mb-4 text-center text-sm font-semibold text-foreground">{title}</p>
        <div className="flex flex-col gap-2">
          <button onClick={onOne} className="rounded-xl border border-border bg-card py-3 text-sm font-semibold text-foreground transition active:scale-[0.99]">Только это</button>
          <button onClick={onAll} className="rounded-xl border border-border bg-card py-3 text-sm font-semibold text-foreground transition active:scale-[0.99]">Вся серия</button>
          <button onClick={onCancel} className="rounded-xl py-3 text-sm text-muted">Отмена</button>
        </div>
      </div>
    </div>
  );
```

- [ ] **Step 2: app/loading.tsx** — token background. Replace:

```tsx
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f0f]">
```
with:
```tsx
    <div className="flex min-h-screen items-center justify-center bg-background">
```

- [ ] **Step 3: calendar skeleton** — create `src/app/(app)/calendar/loading.tsx`:

```tsx
export default function CalendarLoading() {
  return (
    <div className="animate-pulse px-4 pt-4">
      <div className="mx-auto mb-4 h-9 w-48 rounded-full bg-card" />
      <div className="mb-3 flex items-center justify-between">
        <div className="h-9 w-9 rounded-full bg-card" />
        <div className="h-5 w-32 rounded bg-card" />
        <div className="h-9 w-9 rounded-full bg-card" />
      </div>
      <div className="grid grid-cols-7 gap-2 px-2">
        {Array.from({ length: 42 }).map((_, i) => (
          <div key={i} className="mx-auto h-8 w-8 rounded-full bg-card" />
        ))}
      </div>
      <div className="mt-5 flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-card" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck + lint + build** — `npx tsc --noEmit && npm run lint && npm run build`. Expected: clean; `/calendar` still listed.

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/scope-dialog.tsx "src/app/loading.tsx" "src/app/(app)/calendar/loading.tsx"
git commit -m "feat: scope dialog restyle/slide + token loader + calendar skeleton"
```

---

## Task 7: Full verification + visual pass

- [ ] **Step 1: Unit suite unchanged** — `npm test`. Expected: 63 pass (no test files touched).
- [ ] **Step 2: i18n + lint + build** — `npm run check:i18n && npm run lint && npm run build`. Expected: clean.
- [ ] **Step 3: Visual/feel pass** — run the app (run/verify). Confirm:
  - Switching month/week/year and ±nav: the current view stays, a thin accent bar shows briefly at top, content fades-rise in — **no full-screen "Загружаем wheno" flash**.
  - Agenda rows / week sections / year months stagger in.
  - `+` and `✨` sheets slide up from the bottom with a grabber; backdrop fades in.
  - Recurring-event scope dialog slides up, themed.
  - Cold refresh on `/calendar` shows the skeleton (not the global splash).
  - With OS "reduce motion" on, animations are effectively off.
- [ ] **Step 4: Commit any polish**

```bash
git add -A
git commit -m "polish: fast & smooth calendar visual pass"
```

---

## Self-review notes
- **Spec coverage:** useTransition nav (T3), pending indicator (T3), calendar skeleton + token loaders (T6), keyframes + reduced-motion (T1), view enter anim (T3), agenda stagger (T4), BottomSheet primitive (T2) adopted by sheets (T5), scope dialog fade/slide (T6), FAB polish (T3). All covered.
- **Consistency:** all animations use the four keyframes from T1 via `animate-[name_duration_easing]`; `BottomSheet` props `{ onClose, children, className? }` match the call sites in T5; calendar-screen handlers (`switchView`, `navigateWeek`, etc.) unchanged, only `pushView` wrapped.
- **No new tests:** no new pure logic; existing 63 must stay green (T7).
- **Deferred:** sheet exit animations; adjacent-range prefetch; friends/notes restyle.
```
