"use client";

export function ScopeDialog({
  title,
  onOne,
  onAll,
  onCancel,
}: {
  title: string;
  onOne: () => void;
  onAll: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/60" onClick={onCancel}>
      <div className="w-full rounded-t-2xl bg-[#111] p-5 pb-10" onClick={(e) => e.stopPropagation()}>
        <p className="mb-4 text-center text-sm font-semibold text-white">{title}</p>
        <div className="flex flex-col gap-2">
          <button onClick={onOne} className="rounded-xl bg-[#1a1a1a] py-3 text-sm font-semibold text-white">Только это</button>
          <button onClick={onAll} className="rounded-xl bg-[#1a1a1a] py-3 text-sm font-semibold text-white">Вся серия</button>
          <button onClick={onCancel} className="rounded-xl py-3 text-sm text-[#777]">Отмена</button>
        </div>
      </div>
    </div>
  );
}
