import { redirect } from "next/navigation";

import { ActivitiesScreen } from "@/components/activities/activities-screen";
import { getCurrentUser } from "@/lib/auth";
import { getFeed, getMine } from "@/lib/activities/queries";

export const dynamic = "force-dynamic";

export default async function ActivitiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const now = new Date().toISOString();
  const [feed, mine] = await Promise.all([getFeed(user.id, now), getMine(user.id, now)]);
  return <ActivitiesScreen feed={feed} mine={mine} timezone={user.timezone} />;
}
