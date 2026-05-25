import Link from "next/link";

import { Card } from "@/components/ui/card";
import { getTranslations } from "@/lib/i18n";
import type { Language } from "@/lib/preferences-shared";
import type { GroupListItem } from "@/lib/types";

export function GroupCard({
  group,
  language,
}: {
  group: GroupListItem;
  language: Language;
}) {
  const copy = getTranslations(language);

  return (
    <Link href={`/groups/${group.id}`}>
      <Card className="transition duration-200 hover:-translate-y-0.5 hover:border-foreground/12 hover:shadow-[0_30px_80px_-48px_rgba(8,20,39,0.32)]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
              {group.name}
            </h3>
            <p className="text-sm text-muted">
              {copy.nouns.members(group.member_count)} · {copy.common.inviteCode.toLowerCase()}{" "}
              <span className="font-semibold tracking-[0.16em] text-foreground">
                {group.invite_code}
              </span>
            </p>
          </div>
          <span className="rounded-full bg-card-muted px-3 py-1 text-xs font-semibold text-muted ring-1 ring-border/70">
            {group.role === "owner" ? copy.common.owner : copy.common.member}
          </span>
        </div>
        <div className="mt-5 flex items-center justify-between gap-4 border-t border-border/70 pt-4 text-sm text-muted">
          <span>{copy.nouns.meetingRequests(group.open_meeting_count)}</span>
          <span className="font-semibold tracking-[-0.01em] text-foreground">
            {copy.common.openGroup}
          </span>
        </div>
      </Card>
    </Link>
  );
}
