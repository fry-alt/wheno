"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { PHOTO_LIMIT } from "@/lib/profile/profile";
import { deleteProfilePhotoAction, setMainPhotoAction, uploadProfilePhotoAction } from "@/lib/profile/actions";
import type { ProfilePhotoView } from "@/lib/profile/types";

const UPLOAD_ERROR: Record<string, string> = {
  too_large: "Файл больше 8 МБ",
  not_image: "Нужно изображение",
  limit: `Максимум ${PHOTO_LIMIT} фото`,
  empty: "Пустой файл",
  failed: "Не удалось загрузить — попробуй ещё",
};

// Downscale + re-encode to JPEG so big phone photos fit well under the upload
// limit (and load fast). Throws on unsupported images so the caller can fall back.
async function downscale(file: File, maxDim = 1280, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas context");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", quality),
  );
}

export function PhotoGallery({ photos }: { photos: ProfilePhotoView[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    start(async () => {
      try {
        let blob: Blob = file;
        try {
          blob = await downscale(file);
        } catch {
          // Unsupported image (e.g. some HEIC) — fall back to the original.
        }
        const fd = new FormData();
        fd.append("photo", blob, "photo.jpg");
        const res = await uploadProfilePhotoAction(fd);
        if (!res.ok) {
          setError(UPLOAD_ERROR[res.reason ?? ""] ?? "Не удалось загрузить");
          return;
        }
        router.refresh();
      } catch {
        setError("Не удалось загрузить — попробуй ещё");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
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
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
