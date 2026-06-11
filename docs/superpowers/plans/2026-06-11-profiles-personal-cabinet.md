# Profiles / Personal Cabinet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Pure logic is TDD'd (Vitest); DB/storage/components are verified via `tsc`/`lint`/`build` + live screenshots. Tables + Storage bucket are created manually in Supabase (deploy gotcha).

**Goal:** Ship the personal cabinet — own profile view/edit (photo gallery, bio, city, age, gender, interests, privacy toggles) plus a public projection rendered on `/friends/[id]`.

**Architecture:** New `profiles` (1:1) + `profile_photos` tables and a public `profile-photos` Storage bucket. Pure helpers (age, public projection, interest normalization, photo cap) are TDD'd. Server actions (`requireCurrentUser` + admin client) handle writes/uploads; queries read full (own) or projected (public) profiles. A `/profile` route + 4th bottom-nav item host the cabinet; `ProfileView` is reused on the friend page.

**Tech Stack:** Next.js 16 App Router (`force-dynamic`, server actions), React 19, Supabase (`@supabase/supabase-js` admin client + Storage), Tailwind v4 tokens, date-fns, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-11-profiles-personal-cabinet-design.md`

---

## File structure

**New:**
- `src/lib/profile/types.ts` — `Gender`, `Profile`, `ProfilePhoto`, `ProfilePhotoView`, `ProfileWithPhotos`, `PublicProfile`.
- `src/lib/profile/interests.ts` (+ `.test.ts`) — `INTEREST_TAGS`, `isInterestSlug`, `interestLabel`, `normalizeInterests`.
- `src/lib/profile/profile.ts` (+ `.test.ts`) — `ageFromBirthdate`, `publicProfileProjection`, `canAddPhoto`, `PHOTO_LIMIT`.
- `src/lib/profile/queries.ts` — DB + storage reads/writes.
- `src/lib/profile/actions.ts` — server actions.
- `src/components/profile/{profile-screen,photo-gallery,interest-picker,profile-fields,profile-view}.tsx`.
- `src/app/(app)/profile/page.tsx` — cabinet route.

**Modified:**
- `supabase/schema.sql` — two tables.
- `src/components/bottom-nav.tsx` — 4th item 👤.
- `src/app/(app)/friends/[id]/page.tsx` — render `ProfileView`.

**Conventions:** Russian labels hardcoded. Don't touch `src/lib/i18n.ts`. Per-task verify: `npm test` (logic), `npx tsc --noEmit` + `npx eslint <files>` (rest), `npm run build` at checkpoints.

---

## Task 1: Interest tags + normalization (TDD)

**Files:** Create `src/lib/profile/interests.ts`, `src/lib/profile/interests.test.ts`

- [ ] **Step 1: Failing test** — `src/lib/profile/interests.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { INTEREST_TAGS, isInterestSlug, interestLabel, normalizeInterests } from "./interests";

describe("interest tags", () => {
  it("every tag has slug/emoji/label and slugs are unique", () => {
    const slugs = new Set<string>();
    for (const t of INTEREST_TAGS) {
      expect(t.slug).toMatch(/^[a-z]+$/);
      expect(t.emoji).toBeTruthy();
      expect(t.label).toBeTruthy();
      expect(slugs.has(t.slug), `dup ${t.slug}`).toBe(false);
      slugs.add(t.slug);
    }
  });

  it("isInterestSlug recognises curated slugs only", () => {
    expect(isInterestSlug("tennis")).toBe(true);
    expect(isInterestSlug("nonsense")).toBe(false);
  });

  it("interestLabel renders curated as emoji+label, custom as raw", () => {
    expect(interestLabel("tennis")).toBe("🎾 Теннис");
    expect(interestLabel("вязание")).toBe("вязание");
  });

  it("normalizeInterests keeps slugs, trims custom, dedupes, caps at 12, drops empties", () => {
    expect(normalizeInterests(["tennis", "tennis", " coffee ", "  ", "вязание"]))
      .toEqual(["tennis", "coffee", "вязание"]);
    expect(normalizeInterests("nope")).toEqual([]);
    expect(normalizeInterests(Array.from({ length: 20 }, (_, i) => `c${i}`))).toHaveLength(12);
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npm test -- interests`. Expected: module not found.

- [ ] **Step 3: Implement** — `src/lib/profile/interests.ts`:

```ts
export interface InterestTag { slug: string; emoji: string; label: string }

export const INTEREST_TAGS: InterestTag[] = [
  { slug: "running", emoji: "🏃", label: "Бег" },
  { slug: "tennis", emoji: "🎾", label: "Теннис" },
  { slug: "cycling", emoji: "🚴", label: "Велосипед" },
  { slug: "climbing", emoji: "🧗", label: "Скалолазание" },
  { slug: "gym", emoji: "🏋️", label: "Зал" },
  { slug: "yoga", emoji: "🧘", label: "Йога" },
  { slug: "football", emoji: "⚽", label: "Футбол" },
  { slug: "basketball", emoji: "🏀", label: "Баскетбол" },
  { slug: "swimming", emoji: "🏊", label: "Плавание" },
  { slug: "coffee", emoji: "☕", label: "Кофе" },
  { slug: "food", emoji: "🍽️", label: "Еда" },
  { slug: "cooking", emoji: "👨‍🍳", label: "Готовка" },
  { slug: "movies", emoji: "🎬", label: "Кино" },
  { slug: "music", emoji: "🎵", label: "Музыка" },
  { slug: "concerts", emoji: "🎤", label: "Концерты" },
  { slug: "travel", emoji: "✈️", label: "Путешествия" },
  { slug: "boardgames", emoji: "🎲", label: "Настолки" },
  { slug: "videogames", emoji: "🎮", label: "Игры" },
  { slug: "hiking", emoji: "🥾", label: "Хайкинг" },
  { slug: "photography", emoji: "📷", label: "Фото" },
  { slug: "art", emoji: "🎨", label: "Искусство" },
  { slug: "reading", emoji: "📚", label: "Чтение" },
  { slug: "dancing", emoji: "💃", label: "Танцы" },
  { slug: "languages", emoji: "🗣️", label: "Языки" },
];

const BY_SLUG = new Map(INTEREST_TAGS.map((t) => [t.slug, t]));
const MAX_INTERESTS = 12;

export function isInterestSlug(s: string): boolean {
  return BY_SLUG.has(s);
}

export function interestLabel(s: string): string {
  const tag = BY_SLUG.get(s);
  return tag ? `${tag.emoji} ${tag.label}` : s;
}

export function normalizeInterests(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const value = isInterestSlug(item) ? item : item.trim();
    if (!value) continue;
    if (!out.includes(value)) out.push(value);
    if (out.length >= MAX_INTERESTS) break;
  }
  return out;
}
```

- [ ] **Step 4: Run, verify pass** — `npm test -- interests`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/profile/interests.ts src/lib/profile/interests.test.ts
git commit -m "feat: profile interest tags + normalizeInterests (TDD)"
```

---

## Task 2: Profile types + pure helpers (TDD)

**Files:** Create `src/lib/profile/types.ts`, `src/lib/profile/profile.ts`, `src/lib/profile/profile.test.ts`

- [ ] **Step 1: Types** — `src/lib/profile/types.ts`:

```ts
export type Gender = "male" | "female" | "other";

export interface Profile {
  user_id: string;
  bio: string | null;
  city: string | null;
  birthdate: string | null; // yyyy-MM-dd
  gender: Gender | null;
  show_age: boolean;
  show_gender: boolean;
  interests: string[];
  updated_at?: string;
}

export interface ProfilePhoto {
  id: string;
  user_id: string;
  storage_path: string;
  position: number;
  created_at?: string;
}

export interface ProfilePhotoView { id: string; url: string; position: number }

export interface ProfileWithPhotos extends Profile {
  photos: ProfilePhotoView[];
}

export interface PublicProfile {
  user_id: string;
  bio: string | null;
  city: string | null;
  age: number | null;
  gender: Gender | null;
  interests: string[];
  photos: ProfilePhotoView[];
}
```

- [ ] **Step 2: Failing test** — `src/lib/profile/profile.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ageFromBirthdate, publicProfileProjection, canAddPhoto, PHOTO_LIMIT } from "./profile";
import type { ProfileWithPhotos } from "./types";

const base: ProfileWithPhotos = {
  user_id: "u1", bio: "hi", city: "Москва", birthdate: "2000-06-15", gender: "male",
  show_age: true, show_gender: true, interests: ["tennis"], photos: [{ id: "p1", url: "x", position: 0 }],
};

describe("ageFromBirthdate", () => {
  it("computes age, accounting for birthday not yet reached", () => {
    expect(ageFromBirthdate("2000-06-15", "2026-06-15")).toBe(26);
    expect(ageFromBirthdate("2000-06-15", "2026-06-14")).toBe(25);
  });
});

describe("publicProfileProjection", () => {
  it("exposes age when show_age and birthdate set", () => {
    expect(publicProfileProjection(base, "2026-06-15").age).toBe(26);
  });
  it("hides age when show_age false; never leaks birthdate", () => {
    const p = publicProfileProjection({ ...base, show_age: false }, "2026-06-15");
    expect(p.age).toBeNull();
    expect("birthdate" in p).toBe(false);
  });
  it("age null when no birthdate", () => {
    expect(publicProfileProjection({ ...base, birthdate: null }, "2026-06-15").age).toBeNull();
  });
  it("hides gender when show_gender false", () => {
    expect(publicProfileProjection({ ...base, show_gender: false }, "2026-06-15").gender).toBeNull();
  });
  it("passes through bio/city/interests/photos", () => {
    const p = publicProfileProjection(base, "2026-06-15");
    expect(p).toMatchObject({ bio: "hi", city: "Москва", interests: ["tennis"] });
    expect(p.photos).toHaveLength(1);
  });
});

describe("canAddPhoto", () => {
  it("allows below the limit, blocks at it", () => {
    expect(canAddPhoto(0)).toBe(true);
    expect(canAddPhoto(PHOTO_LIMIT - 1)).toBe(true);
    expect(canAddPhoto(PHOTO_LIMIT)).toBe(false);
  });
});
```

- [ ] **Step 3: Run, verify fail** — `npm test -- profile`. Expected: module not found.

- [ ] **Step 4: Implement** — `src/lib/profile/profile.ts`:

```ts
import type { ProfileWithPhotos, PublicProfile } from "./types";

export const PHOTO_LIMIT = 6;

export function ageFromBirthdate(birthdate: string, today: string | Date): number {
  const b = new Date(`${birthdate}T00:00:00Z`);
  const t = typeof today === "string" ? new Date(`${today}T00:00:00Z`) : today;
  let age = t.getUTCFullYear() - b.getUTCFullYear();
  const beforeBirthday =
    t.getUTCMonth() < b.getUTCMonth() ||
    (t.getUTCMonth() === b.getUTCMonth() && t.getUTCDate() < b.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function publicProfileProjection(profile: ProfileWithPhotos, today: string | Date): PublicProfile {
  return {
    user_id: profile.user_id,
    bio: profile.bio,
    city: profile.city,
    age: profile.show_age && profile.birthdate ? ageFromBirthdate(profile.birthdate, today) : null,
    gender: profile.show_gender ? profile.gender : null,
    interests: profile.interests,
    photos: profile.photos,
  };
}

export function canAddPhoto(currentCount: number): boolean {
  return currentCount < PHOTO_LIMIT;
}
```

- [ ] **Step 5: Run, verify pass** — `npm test -- profile`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/profile/types.ts src/lib/profile/profile.ts src/lib/profile/profile.test.ts
git commit -m "feat: profile types + age/projection/photo-cap helpers (TDD)"
```

---

## Task 3: Database schema

**Files:** Modify `supabase/schema.sql`

- [ ] **Step 1: Append** the two tables after the existing `meeting_proposals` block (match existing style — RLS + `set_updated_at` trigger where applicable):

```sql
create table if not exists public.profiles (
  user_id     uuid primary key references public.users(id) on delete cascade,
  bio         text,
  city        text,
  birthdate   date,
  gender      text,
  show_age    boolean not null default true,
  show_gender boolean not null default true,
  interests   text[] not null default '{}',
  updated_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table if not exists public.profile_photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  storage_path text not null,
  position     int  not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists profile_photos_user_idx on public.profile_photos(user_id, position);
alter table public.profile_photos enable row level security;
```

- [ ] **Step 2: Sanity** — `npm run build`. Expected: succeeds (SQL is not compiled, but confirms nothing else broke).

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: profiles + profile_photos tables"
```

---

## Task 4: Profile queries (DB + storage)

**Files:** Create `src/lib/profile/queries.ts`

- [ ] **Step 1: Implement** — `src/lib/profile/queries.ts`:

```ts
import { getAdminSupabase } from "@/lib/supabase/admin";
import { publicProfileProjection } from "./profile";
import type { Gender, Profile, ProfilePhoto, ProfilePhotoView, ProfileWithPhotos, PublicProfile } from "./types";

const BUCKET = "profile-photos";

function emptyProfile(userId: string): Profile {
  return {
    user_id: userId, bio: null, city: null, birthdate: null, gender: null,
    show_age: true, show_gender: true, interests: [],
  };
}

function photoUrl(storagePath: string): string {
  const { data } = getAdminSupabase().storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

async function loadPhotos(userId: string): Promise<ProfilePhotoView[]> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("profile_photos")
    .select("id, storage_path, position")
    .eq("user_id", userId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Pick<ProfilePhoto, "id" | "storage_path" | "position">[]).map((p) => ({
    id: p.id, url: photoUrl(p.storage_path), position: p.position,
  }));
}

export async function getProfile(userId: string): Promise<ProfileWithPhotos> {
  const admin = getAdminSupabase();
  const { data, error } = await admin.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  const profile = (data as Profile | null) ?? emptyProfile(userId);
  return { ...profile, photos: await loadPhotos(userId) };
}

export async function getPublicProfile(userId: string, today: string): Promise<PublicProfile> {
  return publicProfileProjection(await getProfile(userId), today);
}

export async function upsertProfile(
  userId: string,
  fields: { bio: string | null; city: string | null; birthdate: string | null; gender: Gender | null; show_age: boolean; show_gender: boolean; interests: string[] },
): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("profiles")
    .upsert({ user_id: userId, ...fields, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

export async function countPhotos(userId: string): Promise<number> {
  const admin = getAdminSupabase();
  const { count, error } = await admin
    .from("profile_photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function insertPhoto(userId: string, storagePath: string, position: number): Promise<void> {
  const admin = getAdminSupabase();
  const { error } = await admin.from("profile_photos").insert({ user_id: userId, storage_path: storagePath, position });
  if (error) throw new Error(error.message);
}

export async function uploadPhotoObject(userId: string, ext: string, bytes: ArrayBuffer, contentType: string): Promise<string> {
  const admin = getAdminSupabase();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export async function deletePhoto(userId: string, photoId: string): Promise<void> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("profile_photos").select("storage_path").eq("id", photoId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { storage_path: string } | null;
  if (!row) return;
  await admin.storage.from(BUCKET).remove([row.storage_path]);
  const { error: delErr } = await admin.from("profile_photos").delete().eq("id", photoId).eq("user_id", userId);
  if (delErr) throw new Error(delErr.message);
}

export async function setMainPhoto(userId: string, photoId: string): Promise<void> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("profile_photos").select("id, position").eq("user_id", userId).order("position", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: string; position: number }[];
  if (!rows.some((r) => r.id === photoId)) return;
  const reordered = [photoId, ...rows.filter((r) => r.id !== photoId).map((r) => r.id)];
  for (let i = 0; i < reordered.length; i++) {
    const { error: upErr } = await admin.from("profile_photos").update({ position: i }).eq("id", reordered[i]).eq("user_id", userId);
    if (upErr) throw new Error(upErr.message);
  }
}
```

- [ ] **Step 2: Typecheck + lint** — `npx tsc --noEmit && npx eslint src/lib/profile/queries.ts`. Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/profile/queries.ts
git commit -m "feat: profile queries (db + storage)"
```

---

## Task 5: Server actions

**Files:** Create `src/lib/profile/actions.ts`

- [ ] **Step 1: Implement** — `src/lib/profile/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth";
import { normalizeInterests } from "./interests";
import { canAddPhoto } from "./profile";
import { countPhotos, deletePhoto, insertPhoto, setMainPhoto, uploadPhotoObject, upsertProfile } from "./queries";
import type { Gender } from "./types";

const GENDERS: Gender[] = ["male", "female", "other"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function updateProfileAction(input: {
  bio?: string; city?: string; birthdate?: string; gender?: string;
  show_age?: boolean; show_gender?: boolean; interests?: unknown;
}): Promise<void> {
  const user = await requireCurrentUser();
  const gender = GENDERS.includes(input.gender as Gender) ? (input.gender as Gender) : null;
  await upsertProfile(user.id, {
    bio: input.bio?.trim() || null,
    city: input.city?.trim() || null,
    birthdate: input.birthdate && DATE_RE.test(input.birthdate) ? input.birthdate : null,
    gender,
    show_age: input.show_age ?? true,
    show_gender: input.show_gender ?? true,
    interests: normalizeInterests(input.interests),
  });
  revalidatePath("/profile");
}

export async function uploadProfilePhotoAction(formData: FormData): Promise<{ ok: boolean; reason?: string }> {
  const user = await requireCurrentUser();
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, reason: "empty" };
  if (file.size > 5 * 1024 * 1024) return { ok: false, reason: "too_large" };
  if (!canAddPhoto(await countPhotos(user.id))) return { ok: false, reason: "limit" };

  const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const path = await uploadPhotoObject(user.id, ext, await file.arrayBuffer(), file.type || "image/jpeg");
  await insertPhoto(user.id, path, await countPhotos(user.id));
  revalidatePath("/profile");
  return { ok: true };
}

export async function deleteProfilePhotoAction(photoId: string): Promise<void> {
  const user = await requireCurrentUser();
  await deletePhoto(user.id, photoId);
  revalidatePath("/profile");
}

export async function setMainPhotoAction(photoId: string): Promise<void> {
  const user = await requireCurrentUser();
  await setMainPhoto(user.id, photoId);
  revalidatePath("/profile");
}
```

- [ ] **Step 2: Typecheck + lint** — `npx tsc --noEmit && npx eslint src/lib/profile/actions.ts`. Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/profile/actions.ts
git commit -m "feat: profile server actions (update + photo upload/delete/main)"
```

---

## Task 6: Profile components

**Files:** Create `src/components/profile/{profile-view,interest-picker,profile-fields,photo-gallery,profile-screen}.tsx`

- [ ] **Step 1: `profile-view.tsx`** (read-only public projection, reused on friend page):

```tsx
import { interestLabel } from "@/lib/profile/interests";
import type { PublicProfile } from "@/lib/profile/types";

const GENDER_RU: Record<string, string> = { male: "М", female: "Ж", other: "—" };

export function ProfileView({ profile }: { profile: PublicProfile }) {
  const hasAny = profile.bio || profile.city || profile.age != null || profile.interests.length > 0 || profile.photos.length > 0;
  if (!hasAny) return null;
  return (
    <div className="flex flex-col gap-4">
      {profile.photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {profile.photos.map((p) => (
            <img key={p.id} src={p.url} alt="" className="h-40 w-32 flex-shrink-0 rounded-2xl object-cover" />
          ))}
        </div>
      )}
      {(profile.age != null || profile.gender || profile.city) && (
        <p className="text-sm text-muted tabular-nums">
          {[profile.age != null ? `${profile.age}` : null, profile.gender ? GENDER_RU[profile.gender] : null, profile.city]
            .filter(Boolean).join(" · ")}
        </p>
      )}
      {profile.bio && <p className="text-sm text-foreground">{profile.bio}</p>}
      {profile.interests.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {profile.interests.map((s) => (
            <span key={s} className="rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground">{interestLabel(s)}</span>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: `interest-picker.tsx`**:

```tsx
"use client";

import { useState } from "react";
import { clsx } from "clsx";

import { INTEREST_TAGS, isInterestSlug } from "@/lib/profile/interests";

export function InterestPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [custom, setCustom] = useState("");
  const customTags = value.filter((s) => !isInterestSlug(s));

  function toggle(slug: string) {
    onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug]);
  }
  function addCustom() {
    const t = custom.trim();
    if (t && !value.includes(t) && value.length < 12) onChange([...value, t]);
    setCustom("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {INTEREST_TAGS.map((t) => {
          const on = value.includes(t.slug);
          return (
            <button
              key={t.slug}
              type="button"
              onClick={() => toggle(t.slug)}
              className={clsx("rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95",
                on ? "border-accent bg-accent-soft text-accent" : "border-border bg-card text-muted")}
            >
              {t.emoji} {t.label}
            </button>
          );
        })}
        {customTags.map((t) => (
          <button key={t} type="button" onClick={() => onChange(value.filter((s) => s !== t))}
            className="rounded-full border border-accent bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent">
            {t} ✕
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
          placeholder="свой интерес" className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder-muted outline-none" />
        {custom.trim() && <button type="button" onClick={addCustom} className="rounded-xl bg-accent px-3 text-sm font-semibold text-accent-foreground">＋</button>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `profile-fields.tsx`**:

```tsx
"use client";

import type { Gender } from "@/lib/profile/types";

export interface FieldsState {
  bio: string; city: string; birthdate: string; gender: Gender | "";
  show_age: boolean; show_gender: boolean;
}

export function ProfileFields({ state, onChange }: { state: FieldsState; onChange: (next: FieldsState) => void }) {
  const set = (patch: Partial<FieldsState>) => onChange({ ...state, ...patch });
  const inputCls = "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder-muted outline-none";

  return (
    <div className="flex flex-col gap-3">
      <textarea value={state.bio} onChange={(e) => set({ bio: e.target.value })} placeholder="О себе" rows={3} className={inputCls} />
      <input value={state.city} onChange={(e) => set({ city: e.target.value })} placeholder="Город" className={inputCls} />
      <div className="flex items-center gap-2">
        <input type="date" value={state.birthdate} onChange={(e) => set({ birthdate: e.target.value })} className={`${inputCls} flex-1`} />
        <label className="flex items-center gap-1 text-xs text-muted">
          <input type="checkbox" checked={state.show_age} onChange={(e) => set({ show_age: e.target.checked })} /> возраст
        </label>
      </div>
      <div className="flex items-center gap-2">
        <select value={state.gender} onChange={(e) => set({ gender: e.target.value as Gender | "" })} className={`${inputCls} flex-1`}>
          <option value="">Пол не указан</option>
          <option value="male">Мужской</option>
          <option value="female">Женский</option>
          <option value="other">Другой</option>
        </select>
        <label className="flex items-center gap-1 text-xs text-muted">
          <input type="checkbox" checked={state.show_gender} onChange={(e) => set({ show_gender: e.target.checked })} /> пол
        </label>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `photo-gallery.tsx`**:

```tsx
"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

import { PHOTO_LIMIT } from "@/lib/profile/profile";
import { deleteProfilePhotoAction, setMainPhotoAction, uploadProfilePhotoAction } from "@/lib/profile/actions";
import type { ProfilePhotoView } from "@/lib/profile/types";

export function PhotoGallery({ photos }: { photos: ProfilePhotoView[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fd = new FormData();
    fd.append("photo", file);
    await uploadProfilePhotoAction(fd);
    start(() => router.refresh());
  }

  return (
    <div className="flex flex-wrap gap-2">
      {photos.map((p) => (
        <div key={p.id} className="relative">
          <img src={p.url} alt="" className="h-28 w-24 rounded-xl object-cover" />
          {p.position !== 0 && (
            <button onClick={() => start(async () => { await setMainPhotoAction(p.id); router.refresh(); })}
              className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 text-[10px] text-white">★</button>
          )}
          {p.position === 0 && <span className="absolute left-1 top-1 rounded-full bg-accent px-1.5 text-[10px] text-accent-foreground">главное</span>}
          <button onClick={() => start(async () => { await deleteProfilePhotoAction(p.id); router.refresh(); })}
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] text-white">✕</button>
        </div>
      ))}
      {photos.length < PHOTO_LIMIT && (
        <button onClick={() => fileRef.current?.click()} disabled={pending}
          className="flex h-28 w-24 items-center justify-center rounded-xl border border-dashed border-border text-2xl text-muted disabled:opacity-50">＋</button>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
    </div>
  );
}
```

- [ ] **Step 5: `profile-screen.tsx`**:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { PhotoGallery } from "./photo-gallery";
import { InterestPicker } from "./interest-picker";
import { ProfileFields, type FieldsState } from "./profile-fields";
import { SectionLabel } from "@/components/ui/section-label";
import { updateProfileAction } from "@/lib/profile/actions";
import type { ProfileWithPhotos } from "@/lib/profile/types";

export function ProfileScreen({ profile, displayName }: { profile: ProfileWithPhotos; displayName: string }) {
  const router = useRouter();
  const [saving, start] = useTransition();
  const [interests, setInterests] = useState<string[]>(profile.interests);
  const [fields, setFields] = useState<FieldsState>({
    bio: profile.bio ?? "", city: profile.city ?? "", birthdate: profile.birthdate ?? "",
    gender: profile.gender ?? "", show_age: profile.show_age, show_gender: profile.show_gender,
  });
  const [saved, setSaved] = useState(false);

  function save() {
    start(async () => {
      await updateProfileAction({
        bio: fields.bio, city: fields.city, birthdate: fields.birthdate,
        gender: fields.gender || undefined, show_age: fields.show_age, show_gender: fields.show_gender,
        interests,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6 px-4 pt-5 pb-8">
      <h1 className="text-2xl font-bold text-foreground">{displayName}</h1>

      <section className="flex flex-col gap-2">
        <SectionLabel>Фотографии</SectionLabel>
        <PhotoGallery photos={profile.photos} />
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>О себе</SectionLabel>
        <ProfileFields state={fields} onChange={setFields} />
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>Интересы</SectionLabel>
        <InterestPicker value={interests} onChange={setInterests} />
      </section>

      <button onClick={save} disabled={saving}
        className="rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground transition active:scale-[0.99] disabled:opacity-50">
        {saving ? "Сохраняю…" : saved ? "Сохранено ✓" : "Сохранить"}
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck + lint** — `npx tsc --noEmit && npx eslint src/components/profile`. Expected: clean (pre-existing `<img>` warnings allowed).

- [ ] **Step 7: Commit**

```bash
git add src/components/profile
git commit -m "feat: profile cabinet components (view, fields, interests, gallery, screen)"
```

---

## Task 7: Profile route + bottom-nav entry

**Files:** Create `src/app/(app)/profile/page.tsx`; Modify `src/components/bottom-nav.tsx`

- [ ] **Step 1: Route** — `src/app/(app)/profile/page.tsx`:

```tsx
import { redirect } from "next/navigation";

import { ProfileScreen } from "@/components/profile/profile-screen";
import { getCurrentUser } from "@/lib/auth";
import { getProfile } from "@/lib/profile/queries";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const profile = await getProfile(user.id);
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || "Профиль";

  return <ProfileScreen profile={profile} displayName={displayName} />;
}
```

- [ ] **Step 2: Bottom nav** — in `src/components/bottom-nav.tsx`, add a 4th `<Link>` after the Заметки one (keep the existing style):

```tsx
      <Link href="/profile" className="flex flex-col items-center gap-0.5 text-[10px]" style={cls(tab("/profile"))}>
        <span className="text-lg">👤</span>
        Профиль
      </Link>
```

> If `bottom-nav.tsx` was refactored to a `TABS` array, add `{ href: "/profile", emoji: "👤", label: "Профиль" }` to that array instead.

- [ ] **Step 3: Typecheck + lint + build** — `npx tsc --noEmit && npm run lint && npm run build`. Expected: clean; `/profile` appears in the route list.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/profile/page.tsx" src/components/bottom-nav.tsx
git commit -m "feat: /profile route + bottom-nav entry"
```

---

## Task 8: Render public profile on the friend page

**Files:** Modify `src/app/(app)/friends/[id]/page.tsx`

- [ ] **Step 1: Add imports** at the top:

```tsx
import { ProfileView } from "@/components/profile/profile-view";
import { getPublicProfile } from "@/lib/profile/queries";
import { formatInTimeZone } from "date-fns-tz";
```

- [ ] **Step 2: Load the public profile** — after the `getFriendBusy` line:

```tsx
  const today = formatInTimeZone(new Date(), user.timezone, "yyyy-MM-dd");
  const publicProfile = await getPublicProfile(id, today);
```

- [ ] **Step 3: Render it** — insert a section between the header `</div>` and the `Занятость` section:

```tsx
      <section className="mb-6">
        <ProfileView profile={publicProfile} />
      </section>
```

- [ ] **Step 4: Typecheck + lint + build** — `npx tsc --noEmit && npm run lint && npm run build`. Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/friends/[id]/page.tsx"
git commit -m "feat: show public profile on friend page"
```

---

## Task 9: Verification + deploy gotcha

- [ ] **Step 1: Unit suite** — `npm test`. Expected: all pass (adds interests + profile suites to the existing 63).
- [ ] **Step 2: i18n + lint + build** — `npm run check:i18n && npm run lint && npm run build`. Expected: clean.
- [ ] **Step 3: Supabase setup (manual, required before prod works):**
  - Run the `profiles` + `profile_photos` SQL from `supabase/schema.sql` in the Supabase SQL editor.
  - Create a **public** Storage bucket named `profile-photos`.
- [ ] **Step 4: Visual/behaviour pass** — run/verify on a real session: open 👤 Профиль; upload 1–6 photos, set main, delete; edit bio/city/birthdate/gender + toggles; pick curated + custom interests; Save. Open a friend's page → public projection respects show_age/show_gender. Confirm Refined-dark styling.
- [ ] **Step 5: Update backlog memory** — note profiles cabinet shipped + the manual `profiles`/`profile_photos`/bucket setup gotcha, alongside the `meeting_proposals` one.
- [ ] **Step 6: Final commit (if polish)**

```bash
git add -A
git commit -m "polish: profile cabinet visual pass"
```

---

## Self-review notes
- **Spec coverage:** tables + bucket (T3, T9), interest tags + custom (T1), photos ≤6 gallery (T4/T5/T6), fields incl. birthdate→age + gender + privacy toggles (T2/T5/T6), public projection server-side (T2/T4), `/profile` + nav 👤 (T7), friend-page render (T8), TDD helpers (T1/T2), deploy gotcha (T9). All covered.
- **Type consistency:** `Profile`/`ProfileWithPhotos`/`PublicProfile`/`ProfilePhotoView`/`Gender` defined in T2 and used identically in queries (T4), actions (T5), components (T6), pages (T7/T8). `publicProfileProjection(profile, today)`, `canAddPhoto(count)`, `normalizeInterests(raw)`, `PHOTO_LIMIT` signatures match across tasks.
- **Privacy:** hidden age/gender dropped in `publicProfileProjection` (server) — `PublicProfile` has no `birthdate` field, so it cannot leak.
- **Deferred:** stranger visibility, activity feed, matching, places, moderation, signed photo URLs.
```
