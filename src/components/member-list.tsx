import { Avatar } from "@/components/avatar";
import { Card } from "@/components/ui/card";
import { getTranslations } from "@/lib/i18n";
import type { Language } from "@/lib/preferences-shared";
import type { GroupMemberSummary } from "@/lib/types";
import { getDisplayName } from "@/lib/utils";

export function MemberList({
  members,
  language,
}: {
  members: GroupMemberSummary[];
  language: Language;
}) {
  const copy = getTranslations(language);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">{copy.group.membersTitle}</h3>
        <span className="text-sm text-muted">
          {members.length} {copy.common.total}
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {members.map((member) => {
          const label = getDisplayName(member);

          return (
            <div
              className="flex items-center justify-between gap-3 rounded-[22px] border border-border/60 bg-card-muted px-3 py-3"
              key={member.membership_id}
            >
              <div className="flex items-center gap-3">
                <Avatar label={label} size="md" src={member.photo_url} />
                <div>
                  <p className="font-medium text-foreground">{label}</p>
                  <p className="text-xs tracking-[0.01em] text-muted">{member.timezone}</p>
                </div>
              </div>
              <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-muted ring-1 ring-border/80">
                {member.role === "owner" ? copy.common.owner : copy.common.member}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
