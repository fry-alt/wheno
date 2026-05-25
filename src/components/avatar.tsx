/* eslint-disable @next/next/no-img-element */

import { cn, getInitials } from "@/lib/utils";

const sizeStyles = {
  xs: "h-7 w-7 text-[0.62rem]",
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
} as const;

export function Avatar({
  src,
  label,
  size = "md",
  className,
}: {
  src?: string | null;
  label: string;
  size?: keyof typeof sizeStyles;
  className?: string;
}) {
  const fallback = getInitials(label);

  return (
    <div
      aria-label={label}
      className={cn(
        "relative overflow-hidden rounded-full border border-border/70 bg-card-strong text-foreground shadow-[0_12px_28px_-18px_rgba(8,20,39,0.4)]",
        sizeStyles[size],
        className,
      )}
      title={label}
    >
      {src ? (
        // Using a native img keeps Telegram profile URLs simple without image-host config.
        <img
          alt={label}
          className="h-full w-full object-cover"
          decoding="async"
          referrerPolicy="no-referrer"
          src={src}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-foreground font-semibold text-background">
          {fallback}
        </div>
      )}
    </div>
  );
}
