"use client";

import type { Gender } from "@/lib/profile/types";

export interface FieldsState {
  bio: string;
  city: string;
  birthdate: string;
  gender: Gender | "";
  show_age: boolean;
  show_gender: boolean;
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
