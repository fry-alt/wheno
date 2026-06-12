# Events map + settings + nav cleanup (cycle 4)

**Date:** 2026-06-12
**Status:** approved
**Branch:** `feat/events-map-settings`

One cycle, four parts, one deploy. Decisions locked with the user:
rename Движ→События (📍), Leaflet+OSM map, settings as a ⚙️ screen reached from
Profile, build all at once.

---

## A. Settings — language + theme, default = system

**Preference model** (`preferences-shared.ts`):
- `ThemePref = "system" | "light" | "dark"`, `LanguagePref = "system" | "en" | "ru"`.
- Stored in existing cookies `wheno_theme` / `wheno_language`; **default is now
  `system`** (missing/unknown cookie → system). Legacy `light`/`dark`/`en`/`ru`
  values still parse to themselves.
- Hint cookies written by the client from Telegram: `wheno_sys_theme`
  (`light|dark`), `wheno_sys_lang` (`en|ru`).
- Pure resolvers (**TDD**):
  - `resolveTheme(pref, hint) → "light" | "dark"` — system → `hint ?? "dark"`.
  - `resolveLanguage(pref, hint) → "en" | "ru"` — system → `hint ?? "en"`.
- `getUiPreferences()` returns `{ themePref, languagePref, theme, language }`
  (raw prefs + resolved). Root layout applies resolved `data-theme` + `lang`.

**Client sync** (`PreferenceSync`, mounted in the app layout): reads
`window.Telegram.WebApp.colorScheme` and `…initDataUnsafe.user.language_code`
(`startsWith("ru") → ru`, else `en`); writes the hint cookies; if pref is
`system` and the resolved value differs from what is applied, set `data-theme`
immediately and `router.refresh()` (so server strings re-render in the new lang).

**Settings screen** `/settings` (server page → `SettingsScreen` client): two
`Segmented` controls (Тема: Система/Светлая/Тёмная, Язык: Система/Русский/English).
A server action `updatePreferences({ theme?, language? })` sets the cookie(s)
via `getPreferenceCookieConfig()` + `revalidatePath("/", "layout")`.

**Entry point:** ⚙️ icon top-right of the Profile screen → `/settings`.

**Honest scope:** most screen copy is hardcoded Russian; i18n covers only
auth/session/errors. The language switch flips `<html lang>` + the i18n-covered
strings. Full per-screen localization is out of scope for this cycle (separate task).

---

## B. Remove the Заметки tab

- Drop the entry from `BottomNav`; delete `src/app/(app)/notes/page.tsx`.
- **Day-notes stay in the calendar** (independent there). The standalone Задачи
  list leaves the nav; its table/queries/actions are untouched (re-addable later).
- Verify nothing else routes to `/notes`.

---

## C. Движ → События 📍

- `BottomNav`: `{ href: "/activities", emoji: "📍", label: "События" }`.
- Update screen headings / empty-state copy that say "движ"/"активность" to the
  События wording where user-facing. Internal route stays `/activities`.
- Final nav (4 tabs): 📅 Календарь · 👥 Друзья · 📍 События · 👤 Профиль.

---

## D. Map mode + location picker + category filters

**Migration** (`supabase/schema.sql`, manual once):
`alter table activities add column lat double precision, add column lng double precision;`
Nullable. `place` (text) stays as the human label. No coords → not on the map,
still in the list.

**Categories** (`src/lib/activities/category.ts`, **TDD**):
- `CategoryKey = "sport" | "food" | "culture" | "games" | "other"`.
- `ACTIVITY_CATEGORIES: { key, label, emoji, color }[]` — colors: sport `#34c759`,
  food `#ff9f0a`, culture `#bf5af2`, games `#5b7cfa`, other `#8a8a92`.
- `categoryForType(slug) → CategoryKey` maps interest slugs to buckets
  (unknown/custom → other).
- `filterByCategories(activities, keys) → activities` — empty keys = all.

**Types/queries:** `Activity` gains `lat: number | null`, `lng: number | null`;
`COLS` selects them; `createActivity` input + `createActivityAction` accept them.

**Map library:** add `leaflet` + `@types/leaflet`. Use **vanilla Leaflet**
(imperative, no react-leaflet) inside client components to avoid extra deps.
Leaflet CSS imported in the map components. OSM tiles
`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`.

**Components:**
- `ActivityMap` (client) — a div + `useEffect` that builds the map, adds
  category-colored markers for activities with coords passing the active
  filters, `fitBounds` to markers, popup (title · time) linking to the detail.
- `LocationPicker` (client) — mini Leaflet map in the create form; tap
  sets/moves a pin → `onChange({lat,lng})`; optional "📍 моё место"
  (`navigator.geolocation`). Default center when empty: Москва (55.75, 37.62).
- `ActivitiesScreen` feed tab gets a `Segmented` **Список / Карта** + category
  filter chips (multi-select) shown above both. Map consumes the same `feed`.
- `ActivityForm` embeds `LocationPicker`; passes `lat/lng` to the create action.

**Tests:** pure logic TDD'd — preference resolvers, `categoryForType`,
`filterByCategories`. Map/picker are client/visual (user verifies on device).

---

## Out of scope (this cycle)

Full i18n of all screens; radius/"near me" filtering on the map; geocoding the
`place` text; tile-provider key (OSM public tiles fine for MVP scale).

## Deploy notes

- Part D needs the `lat/lng` migration run once in the Supabase SQL editor.
- New npm dep `leaflet` — `npm install` on deploy (Vercel handles it).
