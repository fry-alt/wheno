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
    bio: profile.bio ?? "",
    city: profile.city ?? "",
    birthdate: profile.birthdate ?? "",
    gender: profile.gender ?? "",
    show_age: profile.show_age,
    show_gender: profile.show_gender,
  });
  const [saved, setSaved] = useState(false);

  function save() {
    start(async () => {
      await updateProfileAction({
        bio: fields.bio,
        city: fields.city,
        birthdate: fields.birthdate,
        gender: fields.gender || undefined,
        show_age: fields.show_age,
        show_gender: fields.show_gender,
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

      <button
        onClick={save}
        disabled={saving}
        className="rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground transition active:scale-[0.99] disabled:opacity-50"
      >
        {saving ? "Сохраняю…" : saved ? "Сохранено ✓" : "Сохранить"}
      </button>
    </div>
  );
}
