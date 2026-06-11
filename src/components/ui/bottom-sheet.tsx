"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";

export function BottomSheet({
  onClose,
  children,
  className,
}: {
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 animate-[fadeIn_150ms_ease-out]" onClick={onClose}>
      <div
        className={clsx(
          "absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-card-strong p-5 pb-10",
          "animate-[slideUp_250ms_cubic-bezier(0.22,1,0.36,1)]",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        {children}
      </div>
    </div>
  );
}
