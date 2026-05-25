import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[26px] border border-border/70 bg-card p-5 shadow-[0_20px_48px_-34px_rgba(8,20,39,0.22)]",
        className,
      )}
      {...props}
    />
  );
}
