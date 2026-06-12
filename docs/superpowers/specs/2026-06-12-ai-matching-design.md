# AI matching — «✨ Для тебя» (social cycle 3)

**Date:** 2026-06-12
**Status:** approved
**Branch:** `feat/ai-matching`

## Goal

When the user is free, surface open activities that fit their interests and
free time — the third social-pivot cycle. Deterministic, testable, zero new
tables. Reuses the profile interest tags, the activity feed, and the free/busy
engine already in the codebase.

## Decisions (locked)

- **What we match:** *Activities for you* only (people-matching deferred).
- **Engine:** deterministic scoring, TDD'd as a pure function. No LLM call.
- **No DB migration:** reuses `profiles.interests`, `getFeed`, `isFreeDuring`.

## Engine — `src/lib/activities/match.ts` (pure, TDD)

```ts
export interface ActivityMatch {
  data: ActivityCardData;
  score: number;
  reasons: string[]; // chips, e.g. ["🎯 Бег", "🟢 свободен", "⏱ через 2 дня"]
}

export function rankActivities(
  interests: string[],
  feed: ActivityCardData[],
  nowIso: string,
  opts?: { limit?: number }, // default 5
): ActivityMatch[];
```

**Eligibility filter** (candidate dropped if any fail):
- `isFree` is true (the whole point — suggest when you're free)
- not `isHost`, not `isParticipant`
- not full (`count < capacity` when capacity set)
- `starts_at > now` (not past)
- `status === "open"` (feed already guarantees this)

**Score components** (additive; each contributes a reason when it fires):
- **Interest match** — `activity.type ∈ interests` → `+100`, reason `🎯 <label>`.
- **Soon** — linear decay over a 7-day horizon: `+max(0, 50 - daysAway*7)`,
  reason `⏱ <relative>` (сегодня / завтра / через N дн).
- **Free** — always true for eligible items → reason `🟢 свободен` (0 extra
  points; it is a filter, but shown as a chip).
- **Spots** — capacity set and not near-full → `+10`, reason `👥 N мест`;
  open-ended → `+5`.
- **Place** — `place` present → `+5`, reason `📍 <place>`.

**Output:** eligible candidates sorted by score desc, ties broken by sooner
`starts_at`, sliced to `limit`. Empty array when nothing qualifies (section
hidden). Deterministic — no `Date.now()` inside; `nowIso` passed in.

## UI — `RecommendedRow` in the activities screen

- Section header **«✨ Для тебя»** + subtitle «Свободные слоты под твои интересы».
- Renders only on the **Лента** tab, above the regular list.
- Horizontal snap-scroll row of compact cards; each shows title, host, time,
  and reason chips. Tap → `/activities/[id]`.
- **Empty-interests nudge:** if `interests.length === 0`, replace the row with a
  soft card «Добавь интересы в профиле, чтобы получать подборки» → links `/profile`.
- If interests set but no matches: render nothing (no empty box).

## Data flow

- `activities/page.tsx` already loads `feed`/`mine`. Add `getProfile(user.id)`
  to read `interests`; compute `recommended = rankActivities(interests, feed, now)`
  in the server component (pure, cheap) and pass `recommended` + `interests`
  into `ActivitiesScreen`.

## Testing

- `src/lib/activities/match.test.ts`: eligibility filtering, interest-match
  boost ordering, soon decay, full/past exclusion, limit, empty input, reasons
  content, deterministic ordering with ties.

## Out of scope (this cycle)

- People matching, LLM blurbs, structured city matching, places sub-project.
