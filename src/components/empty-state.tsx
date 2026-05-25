import Link from "next/link";

import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <Card className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-foreground text-lg font-semibold text-background shadow-[0_24px_50px_-28px_rgba(8,20,39,0.82)]">
        wheno
      </div>
      <div className="mt-5 space-y-2">
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">{title}</h2>
        <p className="text-sm leading-7 text-muted">{description}</p>
      </div>
      {actionLabel && actionHref ? (
        <Link className={buttonStyles({ fullWidth: true, className: "mt-6" })} href={actionHref}>
          {actionLabel}
        </Link>
      ) : null}
    </Card>
  );
}
