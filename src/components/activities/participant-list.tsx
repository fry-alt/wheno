import { getInitials } from "@/lib/utils";
import type { ParticipantView } from "@/lib/activities/types";

export function ParticipantList({ participants }: { participants: ParticipantView[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {participants.map((p) => (
        <div key={p.user_id} className="flex flex-col items-center gap-1">
          {p.photo_url ? (
            <img src={p.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-card-strong text-xs font-semibold text-foreground">{getInitials(p.name)}</span>
          )}
          <span className="max-w-14 truncate text-[10px] text-muted">{p.name}</span>
        </div>
      ))}
    </div>
  );
}
