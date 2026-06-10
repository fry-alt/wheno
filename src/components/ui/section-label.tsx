import { clsx } from "clsx";
import type { ReactNode } from "react";

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={clsx("text-[10px] font-semibold uppercase tracking-[0.12em] text-muted", className)}>
      {children}
    </p>
  );
}
