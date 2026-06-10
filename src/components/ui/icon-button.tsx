import { clsx } from "clsx";
import type { ReactNode } from "react";

export function IconButton({
  children,
  onClick,
  ariaLabel,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={clsx(
        "flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-lg text-foreground/80",
        "transition active:scale-95 active:bg-card-strong",
        className,
      )}
    >
      {children}
    </button>
  );
}
