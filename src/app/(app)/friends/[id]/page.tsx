import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";

import { BusyGrid } from "@/components/friends/busy-grid";
import { MeetingForm } from "@/components/friends/meeting-form";
import { AddFriendButton } from "@/components/friends/add-friend-button";
import { BackButton } from "@/components/back-button";
import { ProfileView } from "@/components/profile/profile-view";
import { getCurrentUser } from "@/lib/auth";
import { getFriendBusy, findFriendshipBetween } from "@/lib/friends/queries";
import { getPublicProfile } from "@/lib/profile/queries";
import { getUserById } from "@/lib/users";
import { isBlockedEitherWay } from "@/lib/safety/queries";
import { getDisplayName, getInitials } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FriendProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();
  if (id === user.id) redirect("/profile");

  const target = await getUserById(id);
  if (!target) notFound();
  if (await isBlockedEitherWay(user.id, id)) notFound();

  const friendship = await findFriendshipBetween(user.id, id);
  const areFriends = friendship?.status === "accepted";
  const pendingRequest = friendship?.status === "pending";

  const today = formatInTimeZone(new Date(), user.timezone, "yyyy-MM-dd");
  const publicProfile = await getPublicProfile(id, today);
  const name = getDisplayName(target);
  const busy = areFriends ? await getFriendBusy(user.id, id) : null;

  return (
    <div className="px-4 pt-5 pb-8 animate-[fadeRise_300ms_ease-out]">
      <BackButton href="/friends" />
      <Link href="/friends" className="mb-4 inline-block text-sm text-muted">← Друзья</Link>

      <div className="mb-5 flex items-center gap-3">
        {target.photo_url ? (
          <img src={target.photo_url} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-card-strong text-lg font-semibold text-foreground">
            {getInitials(name)}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-foreground">{name}</h1>
          {target.username && <p className="truncate text-sm text-muted">@{target.username}</p>}
        </div>
      </div>

      <section className="mb-6">
        <ProfileView profile={publicProfile} />
      </section>

      {areFriends && busy ? (
        <>
          <section className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Занятость · 7 дней</p>
            <BusyGrid busy={busy.intervals} timezone={busy.timezone} />
          </section>
          <MeetingForm friendId={id} />
        </>
      ) : (
        <AddFriendButton targetId={id} initialPending={pendingRequest} />
      )}
    </div>
  );
}
