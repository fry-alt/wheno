import { selectMeetingOptionAction, voteMeetingOptionAction } from "@/lib/actions";
import type { MeetingOptionDetail, VoteValue } from "@/lib/types";
import { formatSlotDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const VOTES: VoteValue[] = ["yes", "maybe", "no"];

export function MeetingOptionCard({
  option,
  meetingId,
  timezone,
  isOwner,
  isSelected,
}: {
  option: MeetingOptionDetail;
  meetingId: string;
  timezone: string;
  isOwner: boolean;
  isSelected: boolean;
}) {
  const slot = formatSlotDateTime(option.start_at, option.end_at, timezone);

  return (
    <Card className={cn(isSelected && "border-blue-300 ring-4 ring-blue-100")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-blue-700">
            {slot.date}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{slot.time}</h3>
        </div>
        <div className="rounded-2xl bg-slate-100 px-3 py-2 text-right">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">score</p>
          <p className="text-lg font-semibold text-slate-900">{option.score}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 sm:grid-cols-2">
        <div>
          <p className="font-semibold text-slate-900">
            {option.free_members.length} free member{option.free_members.length === 1 ? "" : "s"}
          </p>
          <p className="mt-1 leading-6">
            {option.free_members.length ? option.free_members.join(", ") : "No one is free."}
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-900">
            {option.busy_members.length} busy member{option.busy_members.length === 1 ? "" : "s"}
          </p>
          <p className="mt-1 leading-6">
            {option.busy_members.length ? option.busy_members.join(", ") : "Everyone is free."}
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
                {vote}
              </Button>
            </form>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Votes: {option.votes.yes} yes · {option.votes.maybe} maybe · {option.votes.no} no
      </p>

      {isSelected ? (
        <p className="mt-4 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
          This slot has been selected.
        </p>
      ) : null}

      {isOwner && !isSelected ? (
        <form action={selectMeetingOptionAction} className="mt-4">
          <input name="meetingId" type="hidden" value={meetingId} />
          <input name="optionId" type="hidden" value={option.id} />
          <Button fullWidth type="submit">
            Select this slot
          </Button>
        </form>
      ) : null}
    </Card>
  );
}
