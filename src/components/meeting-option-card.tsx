import { selectMeetingOptionAction, voteMeetingOptionAction } from "@/lib/actions";
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
          <p className="mt-1 leading-6">
            {option.free_members.length ? option.free_members.join(", ") : copy.common.noOneFree}
          </p>
        </div>
        <div>
          <p className="font-semibold text-foreground">
            {copy.nouns.busyMembers(option.busy_members.length)}
          </p>
          <p className="mt-1 leading-6">
            {option.busy_members.length ? option.busy_members.join(", ") : copy.common.everyoneFree}
          </p>
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
              <Button size="sm" variant={isActive ? "primary" : "secondary"} type="submit">
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
