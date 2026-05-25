import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export function Input({ label, hint, error, className, id, ...props }: InputProps) {
  return (
    <label className="block space-y-2" htmlFor={id}>
      {label ? (
        <span className="block text-sm font-semibold text-foreground">{label}</span>
      ) : null}
      <input
        id={id}
        className={cn(
          "h-12 w-full rounded-[20px] border border-border/80 bg-card-muted px-4 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-foreground/20 focus:bg-card-strong focus:ring-4 focus:ring-accent-soft/90",
          error && "border-danger/50 focus:border-danger/60 focus:ring-danger-soft/90",
          className,
        )}
        {...props}
      />
      {error ? (
        <span className="block text-xs font-medium text-danger">{error}</span>
      ) : hint ? (
        <span className="block text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  );
}
