import { notFound, redirect } from "next/navigation";

import { ActivityDetail } from "@/components/activities/activity-detail";
import { getCurrentUser } from "@/lib/auth";
import { getActivity, participantViews } from "@/lib/activities/queries";
import { activityButtonState } from "@/lib/activities/state";

export const dynamic = "force-dynamic";

export default async function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const activity = await getActivity(id);
  if (!activity) notFound();

  const participants = await participantViews(id);
  const isHost = activity.host_id === user.id;
  const state = activityButtonState({
    isHost,
    isParticipant: participants.some((p) => p.user_id === user.id),
    count: participants.length,
    capacity: activity.capacity,
    status: activity.status,
    startsAt: activity.starts_at,
    now: new Date().toISOString(),
  });

  return <ActivityDetail activity={activity} participants={participants} state={state} isHost={isHost} timezone={user.timezone} />;
}
