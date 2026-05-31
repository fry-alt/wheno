import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card px-4 py-4 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
