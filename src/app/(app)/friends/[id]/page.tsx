import Link from "next/link";
import { notFound } from "next/navigation";

import { BusyGrid } from "@/components/friends/busy-grid";
import { MeetingForm } from "@/components/friends/meeting-form";
import { getCurrentUser } from "@/lib/auth";
import { getFriendBusy, getFriendSummary } from "@/lib/friends/queries";
import { getInitials } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FriendProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();

  const friend = await getFriendSummary(user.id, id);
  if (!friend) notFound();

  const { timezone, intervals } = await getFriendBusy(user.id, id);

  return (
    <div className="px-4 pt-5">
      <Link href="/friends" className="mb-4 inline-block text-sm text-[#555]">← Друзья</Link>

      <div className="mb-5 flex items-center gap-3">
        {friend.photo_url ? (
          <img src={friend.photo_url} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2a2a2a] text-lg font-semibold text-white">
            {getInitials(friend.name)}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-white">{friend.name}</h1>
          {friend.username && <p className="truncate text-sm text-[#555]">@{friend.username}</p>}
        </div>
      </div>

      <section className="mb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#555]">Занятость · 7 дней</p>
        <BusyGrid busy={intervals} timezone={timezone} />
      </section>

      <MeetingForm friendId={friend.user_id} />
    </div>
  );
}
