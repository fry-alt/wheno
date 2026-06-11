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
}
