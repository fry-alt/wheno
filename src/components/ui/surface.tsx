import { clsx } from "clsx";
import type { ReactNode } from "react";

export function Surface({
  children,
  elevated = false,
  className,
}: {
  children: ReactNode;
  elevated?: boolean;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-border",
        elevated
          ? "bg-card-strong shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_24px_rgba(0,0,0,0.35)]"
          : "bg-card",
        className,
      )}
    >
      {children}
    </div>
  );
}
