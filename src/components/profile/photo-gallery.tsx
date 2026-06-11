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
            <button
              onClick={() => start(async () => { await setMainPhotoAction(p.id); router.refresh(); })}
              className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 text-[10px] text-white"
            >
              ★
            </button>
          )}
          {p.position === 0 && (
            <span className="absolute left-1 top-1 rounded-full bg-accent px-1.5 text-[10px] text-accent-foreground">главное</span>
          )}
          <button
            onClick={() => start(async () => { await deleteProfilePhotoAction(p.id); router.refresh(); })}
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] text-white"
          >
            ✕
          </button>
        </div>
      ))}
      {photos.length < PHOTO_LIMIT && (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={pending}
          className="flex h-28 w-24 items-center justify-center rounded-xl border border-dashed border-border text-2xl text-muted disabled:opacity-50"
        >
          ＋
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
    </div>
  );
}
