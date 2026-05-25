import { Card } from "@/components/ui/card";
import type { GroupMemberSummary } from "@/lib/types";
import { getDisplayName, getInitials } from "@/lib/utils";

export function MemberList({ members }: { members: GroupMemberSummary[] }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">Members</h3>
        <span className="text-sm text-slate-500">{members.length} total</span>
      </div>
      <div className="mt-4 space-y-3">
        {members.map((member) => {
          const label = getDisplayName(member);

          return (
            <div
              className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-3"
              key={member.membership_id}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
                  {getInitials(label)}
                </div>
                <div>
                  <p className="font-medium text-slate-900">{label}</p>
                  <p className="text-xs text-slate-500">{member.timezone}</p>
                </div>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                {member.role}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
