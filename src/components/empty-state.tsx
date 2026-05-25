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
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl">
        + 
      </div>
      <div className="mt-4 space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {actionLabel && actionHref ? (
        <Link className={buttonStyles({ fullWidth: true, className: "mt-5" })} href={actionHref}>
          {actionLabel}
        </Link>
      ) : null}
    </Card>
  );
}
