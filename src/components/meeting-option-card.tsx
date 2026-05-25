import { selectMeetingOptionAction, voteMeetingOptionAction } from "@/lib/actions";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatSlotDateTime } from "@/lib/datetime";
import { getTranslations } from "@/lib/i18n";
import type { Language } from "@/lib/preferences-shared";
import type { MeetingOptionDetail, VoteValue } from "@/lib/types";
import { cn } from "@/lib/utils";

const VOTES: VoteValue[] = ["yes", "maybe", "no"];

export function MeetingOptionCard({
  option,
  meetingId,
  timezone,
  language,
  isOwner,
  isSelected,
}: {
  option: MeetingOptionDetail;
  meetingId: string;
  timezone: string;
  language: Language;
  isOwner: boolean;
  isSelected: boolean;
}) {
  const slot = formatSlotDateTime(option.start_at, option.end_at, timezone, language);
  const copy = getTranslations(language);
  const voteLabels: Record<VoteValue, string> = {
    yes: copy.common.yes,
    maybe: copy.common.maybe,
    no: copy.common.no,
  };
  const voteButtonStyles: Record<VoteValue, { active: string; idle: string }> = {
    yes: {
      active: "bg-emerald-600 text-white ring-emerald-600 shadow-[0_16px_28px_-18px_rgba(5,150,105,0.45)]",
      idle: "text-emerald-700 ring-emerald-200 hover:bg-emerald-50 dark:text-emerald-300 dark:ring-emerald-500/25 dark:hover:bg-emerald-500/10",
    },
    maybe: {
      active: "bg-amber-500 text-slate-950 ring-amber-500 shadow-[0_16px_28px_-18px_rgba(245,158,11,0.45)]",
      idle: "text-amber-700 ring-amber-200 hover:bg-amber-50 dark:text-amber-300 dark:ring-amber-500/25 dark:hover:bg-amber-500/10",
    },
    no: {
      active: "bg-rose-500 text-white ring-rose-500 shadow-[0_16px_28px_-18px_rgba(244,63,94,0.42)]",
      idle: "text-rose-700 ring-rose-200 hover:bg-rose-50 dark:text-rose-300 dark:ring-rose-500/25 dark:hover:bg-rose-500/10",
    },
  };

  return (
    <Card
      className={cn(
        "overflow-hidden",
        isSelected && "border-foreground/18 bg-card-strong ring-4 ring-accent-soft/90",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">
            {slot.date}
          </p>
          <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-foreground">
            {slot.time}
          </h3>
        </div>
        <div className="rounded-[22px] border border-border/70 bg-card-muted px-3 py-2 text-right">
          <p className="text-xs uppercase tracking-[0.12em] text-muted">{copy.common.score}</p>
          <p className="text-lg font-semibold text-foreground">{option.score}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-[24px] border border-border/60 bg-card-muted p-4 text-sm text-muted sm:grid-cols-2">
        <div>
          <p className="font-semibold text-foreground">
            {copy.nouns.freeMembers(option.free_members.length)}
          </p>
          {option.free_members.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {option.free_members.map((member) => (
                <span
                  className="inline-flex items-center gap-2 rounded-full bg-card px-2.5 py-1.5 ring-1 ring-border/70"
                  key={member.user_id}
                >
                  <Avatar label={member.name} size="xs" src={member.photo_url} />
                  <span className="text-xs font-medium text-foreground">{member.name}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 leading-6">{copy.common.noOneFree}</p>
          )}
        </div>
        <div>
          <p className="font-semibold text-foreground">
            {copy.nouns.busyMembers(option.busy_members.length)}
          </p>
          {option.busy_members.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {option.busy_members.map((member) => (
                <span
                  className="inline-flex items-center gap-2 rounded-full bg-card px-2.5 py-1.5 ring-1 ring-border/70"
                  key={member.user_id}
                >
                  <Avatar label={member.name} size="xs" src={member.photo_url} />
                  <span className="text-xs font-medium text-foreground">{member.name}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 leading-6">{copy.common.everyoneFree}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {VOTES.map((vote) => {
          const isActive = option.current_user_vote === vote;

          return (
            <form action={voteMeetingOptionAction} key={vote}>
              <input name="meetingId" type="hidden" value={meetingId} />
              <input name="optionId" type="hidden" value={option.id} />
              <input name="vote" type="hidden" value={vote} />
              <Button
                className={cn(
                  "ring-1",
                  isActive ? voteButtonStyles[vote].active : voteButtonStyles[vote].idle,
                )}
                size="sm"
                type="submit"
                variant="ghost"
              >
                {voteLabels[vote]}
              </Button>
            </form>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-muted">
        {copy.common.voteSummary(option.votes.yes, option.votes.maybe, option.votes.no)}
      </p>

      {isSelected ? (
        <p className="mt-4 rounded-[22px] bg-success-soft px-4 py-3 text-sm font-medium text-foreground">
          {copy.common.selectedSlot}
        </p>
      ) : null}

      {isOwner && !isSelected ? (
        <form action={selectMeetingOptionAction} className="mt-4">
          <input name="meetingId" type="hidden" value={meetingId} />
          <input name="optionId" type="hidden" value={option.id} />
          <Button fullWidth type="submit">
            {copy.common.selectThisSlot}
          </Button>
        </form>
      ) : null}
    </Card>
  );
}
