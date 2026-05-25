import Link from "next/link";

import { Card } from "@/components/ui/card";
import type { GroupListItem } from "@/lib/types";

export function GroupCard({ group }: { group: GroupListItem }) {
  return (
    <Link href={`/groups/${group.id}`}>
      <Card className="transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_20px_60px_-36px_rgba(37,99,235,0.45)]">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-900">{group.name}</h3>
            <p className="text-sm text-slate-500">
              {group.member_count} member{group.member_count === 1 ? "" : "s"} · code{" "}
              <span className="font-semibold text-slate-700">{group.invite_code}</span>
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
            {group.role}
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>{group.open_meeting_count} open meeting request{group.open_meeting_count === 1 ? "" : "s"}</span>
          <span>Open group</span>
        </div>
      </Card>
    </Link>
  );
}
