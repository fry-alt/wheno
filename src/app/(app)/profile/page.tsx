import { redirect } from "next/navigation";

import { ProfileScreen } from "@/components/profile/profile-screen";
import { getCurrentUser } from "@/lib/auth";
import { getProfile } from "@/lib/profile/queries";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const profile = await getProfile(user.id);
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || "Профиль";

  return <ProfileScreen profile={profile} displayName={displayName} />;
}
