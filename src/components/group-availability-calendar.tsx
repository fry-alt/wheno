import { addDays, format, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { Avatar } from "@/components/avatar";
import { Card } from "@/components/ui/card";
import { formatSlotDateTime } from "@/lib/datetime";
import type { Language } from "@/lib/preferences-shared";
import type { GroupBusyBlockSummary, GroupMemberSummary } from "@/lib/types";
import { cn, getDisplayName } from "@/lib/utils";

type GroupAvailabilityCopy = {
  availabilityTitle: string;
  availabilityDescription: string;
  availabilityEmptyDay: string;
  availabilityNoBlocks: string;
  availabilityBlocks: string;
};

type MemberIdentity = {
  name: string;
  photo_url: string | null;
};

export function GroupAvailabilityCalendar({
  blocks,
  copy,
  language,
  members,
  timezone,
  weekStart,
}: {
  blocks: GroupBusyBlockSummary[];
  copy: GroupAvailabilityCopy;
  language: Language;
  members: GroupMemberSummary[];
  timezone: string;
  weekStart: string;
}) {
  const memberDirectory = new Map<string, MemberIdentity>(
    members.map((member) => [
      member.user_id,
      {
        name: getDisplayName(member),
        photo_url: member.photo_url,
      },
    ]),
  );
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(parseISO(weekStart), index);
    const key = format(date, "yyyy-MM-dd");
    const midday = fromZonedTime(`${key}T12:00:00`, timezone);

    return {
      key,
      label: formatInTimeZone(midday, timezone, "EEE"),
      number: formatInTimeZone(midday, timezone, "d"),
      blocks: blocks.filter(
        (block) => formatInTimeZone(block.start_at, timezone, "yyyy-MM-dd") === key,
      ),
    };
  });

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border/70 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {copy.availabilityTitle}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              {copy.availabilityDescription}
            </p>
          </div>
          <span className="rounded-full bg-card-muted px-3 py-1 text-xs font-semibold text-muted ring-1 ring-border/70">
            {blocks.length} {copy.availabilityBlocks}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[46rem] grid-cols-7 divide-x divide-border/60">
          {days.map((day) => (
            <section className="min-h-[20rem] bg-card" key={day.key}>
              <div className="sticky top-0 z-10 border-b border-border/60 bg-card-muted/95 px-3 py-3 text-center backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  {day.label}
                </p>
                <p className="mt-1 text-xl font-semibold text-foreground">{day.number}</p>
              </div>

              {day.blocks.length ? (
                <div className="space-y-2 p-2.5">
                  {day.blocks.map((block, blockIndex) => {
                    const member = memberDirectory.get(block.user_id) ?? {
                      name: "Unknown",
                      photo_url: null,
                    };

                    return (
                      <BusyBlock
                        block={block}
                        blockIndex={blockIndex}
                        key={block.id}
                        language={language}
                        member={member}
                        timezone={timezone}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="p-2.5">
                  <div className="rounded-[18px] border border-dashed border-border/70 bg-card-muted px-3 py-5 text-center text-xs font-semibold text-muted">
                    {copy.availabilityEmptyDay}
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>
      </div>

      {!blocks.length ? (
        <div className="border-t border-border/70 px-5 py-4 text-center text-sm leading-6 text-muted">
          {copy.availabilityNoBlocks}
        </div>
      ) : null}
    </Card>
  );
}

function BusyBlock({
  block,
  blockIndex,
  language,
  member,
  timezone,
}: {
  block: GroupBusyBlockSummary;
  blockIndex: number;
  language: Language;
  member: MemberIdentity;
  timezone: string;
}) {
  const slot = formatSlotDateTime(block.start_at, block.end_at, timezone, language);

  return (
    <article
      className={cn(
        "rounded-[18px] border px-3 py-3 shadow-[0_16px_30px_-26px_rgba(8,20,39,0.4)]",
        blockIndex % 4 === 0 &&
          "border-blue-500/30 bg-blue-500/12 text-blue-950 dark:text-blue-100",
        blockIndex % 4 === 1 &&
          "border-emerald-500/30 bg-emerald-500/12 text-emerald-950 dark:text-emerald-100",
        blockIndex % 4 === 2 &&
          "border-amber-500/30 bg-amber-500/14 text-amber-950 dark:text-amber-100",
        blockIndex % 4 === 3 &&
          "border-rose-500/30 bg-rose-500/12 text-rose-950 dark:text-rose-100",
      )}
    >
      <p className="text-xs font-semibold opacity-75">{slot.time}</p>
      <p className="mt-1 truncate text-sm font-semibold">{block.title}</p>
      <div className="mt-3 flex min-w-0 items-center gap-2">
        <Avatar label={member.name} size="xs" src={member.photo_url} />
        <span className="min-w-0 truncate text-xs font-semibold opacity-80">
          {member.name}
        </span>
      </div>
    </article>
  );
}
