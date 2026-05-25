import type { SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  hint?: string;
};

export function Select({ label, hint, className, id, children, ...props }: SelectProps) {
  return (
    <label className="block space-y-2" htmlFor={id}>
      {label ? (
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
      ) : null}
      <select
        id={id}
        className={cn(
          "h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}
