import { redirect } from "next/navigation";

import { ActivitiesScreen } from "@/components/activities/activities-screen";
import { getCurrentUser } from "@/lib/auth";
import { getFeed, getMine } from "@/lib/activities/queries";
import { getProfile } from "@/lib/profile/queries";
import { rankActivities } from "@/lib/activities/match";

export const dynamic = "force-dynamic";

export default async function ActivitiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const now = new Date().toISOString();
  const [feed, mine, profile] = await Promise.all([
    getFeed(user.id, now),
    getMine(user.id, now),
    getProfile(user.id),
  ]);
  const recommended = rankActivities(profile.interests, feed, now, { timezone: user.timezone });
  return (
    <ActivitiesScreen
      feed={feed}
      mine={mine}
      recommended={recommended}
      interests={profile.interests}
      timezone={user.timezone}
    />
  );
}
