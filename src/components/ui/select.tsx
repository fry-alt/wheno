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
        <span className="block text-sm font-semibold text-foreground">{label}</span>
      ) : null}
      <select
        id={id}
        className={cn(
          "h-12 w-full rounded-[20px] border border-border/80 bg-card-muted px-4 text-sm text-foreground outline-none transition focus:border-foreground/20 focus:bg-card-strong focus:ring-4 focus:ring-accent-soft/90",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}
