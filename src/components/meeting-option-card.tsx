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
  totalMembers,
}: {
  option: MeetingOptionDetail;
  meetingId: string;
  timezone: string;
  language: Language;
  isOwner: boolean;
  isSelected: boolean;
  totalMembers: number;
}) {
  const slot = formatSlotDateTime(option.start_at, option.end_at, timezone, language);
  const copy = getTranslations(language);

  const freeCount = option.free_members.length;
  const freeRatio = totalMembers > 0 ? freeCount / totalMembers : 0;

  const voteLabels: Record<VoteValue, string> = {
    yes: copy.common.yes,
    maybe: copy.common.maybe,
    no: copy.common.no,
  };

  const voteColors: Record<VoteValue, { active: string; idle: string }> = {
    yes: {
      active: "bg-emerald-500 text-white ring-emerald-500",
      idle: "text-emerald-600 ring-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:ring-emerald-700 dark:hover:bg-emerald-900/30",
    },
    maybe: {
      active: "bg-amber-400 text-slate-900 ring-amber-400",
      idle: "text-amber-600 ring-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:ring-amber-700 dark:hover:bg-amber-900/30",
    },
    no: {
      active: "bg-danger text-white ring-danger",
      idle: "text-danger ring-danger/30 hover:bg-danger-soft",
    },
  };

  return (
    <Card
      className={cn(
        "space-y-4",
        isSelected && "ring-2 ring-accent/60",
      )}
    >
      {/* ── Date / time ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-muted">
            {slot.date}
          </p>
          <p className="text-xl font-bold tracking-tight text-foreground">{slot.time}</p>
        </div>

        {/* Free ratio pill */}
        <div className="flex flex-col items-end gap-1">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              freeRatio === 1
                ? "bg-success-soft text-success"
                : freeRatio >= 0.5
                  ? "bg-accent/10 text-accent"
                  : "bg-card-muted text-muted",
            )}
          >
            {copy.meeting.freeOf(freeCount, totalMembers)}
          </span>
          {/* Visual bar */}
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-card-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                freeRatio === 1 ? "bg-success" : freeRatio >= 0.5 ? "bg-accent" : "bg-muted",
              )}
              style={{ width: `${Math.round(freeRatio * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Free / busy members ── */}
      {(option.free_members.length > 0 || option.busy_members.length > 0) ? (
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-card-muted px-3 py-3 text-xs">
          <div>
            <p className="mb-1.5 font-semibold text-foreground">
              {copy.nouns.freeMembers(option.free_members.length)}
            </p>
            {option.free_members.length ? (
              <div className="flex flex-wrap gap-1.5">
                {option.free_members.map((m) => (
                  <span
                    className="flex items-center gap-1 rounded-full bg-card px-2 py-1 ring-1 ring-border/50"
                    key={m.user_id}
                  >
                    <Avatar label={m.name} size="xs" src={m.photo_url} />
                    <span className="text-[0.7rem] text-foreground">{m.name}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-muted">{copy.common.noOneFree}</p>
            )}
          </div>

          {option.busy_members.length > 0 ? (
            <div>
              <p className="mb-1.5 font-semibold text-foreground">
                {copy.nouns.busyMembers(option.busy_members.length)}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {option.busy_members.map((m) => (
                  <span
                    className="flex items-center gap-1 rounded-full bg-card px-2 py-1 ring-1 ring-border/50 opacity-60"
                    key={m.user_id}
                  >
                    <Avatar label={m.name} size="xs" src={m.photo_url} />
                    <span className="text-[0.7rem] text-foreground">{m.name}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── Vote buttons ── */}
      <div className="flex items-center gap-2">
        {VOTES.map((vote) => {
          const isActive = option.current_user_vote === vote;
          return (
            <form action={voteMeetingOptionAction} key={vote}>
              <input name="meetingId" type="hidden" value={meetingId} />
              <input name="optionId"  type="hidden" value={option.id} />
              <input name="vote"      type="hidden" value={vote} />
              <Button
                className={cn(
                  "ring-1",
                  isActive ? voteColors[vote].active : voteColors[vote].idle,
                )}
                size="sm"
                type="submit"
                variant="ghost"
              >
                {voteLabels[vote]}
                {option.votes[vote] > 0 ? (
                  <span className="ml-1 opacity-70">{option.votes[vote]}</span>
                ) : null}
              </Button>
            </form>
          );
        })}
      </div>

      {/* ── Selected banner ── */}
      {isSelected ? (
        <p className="rounded-xl bg-success-soft px-3 py-2.5 text-sm font-medium text-success">
          {copy.common.selectedSlot}
        </p>
      ) : null}

      {/* ── Owner select action ── */}
      {isOwner && !isSelected ? (
        <form action={selectMeetingOptionAction}>
          <input name="meetingId" type="hidden" value={meetingId} />
          <input name="optionId"  type="hidden" value={option.id} />
          <Button fullWidth type="submit">
            {copy.common.selectThisSlot}
          </Button>
        </form>
      ) : null}
    </Card>
  );
}
