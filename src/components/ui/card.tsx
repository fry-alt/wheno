import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[30px] border border-border/70 bg-card p-5 shadow-[0_26px_70px_-44px_rgba(8,20,39,0.58)] backdrop-blur",
        className,
      )}
      {...props}
    />
  );
}
