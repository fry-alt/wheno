import { FriendsScreen } from "@/components/friends/friends-screen";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { getCurrentUser } from "@/lib/auth";
import { listFriends, listIncomingRequests } from "@/lib/friends/queries";
import { getUiPreferences } from "@/lib/preferences";

export const dynamic = "force-dynamic";

export default async function FriendsPage() {
  const user = await getCurrentUser();
  const { language } = await getUiPreferences();

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#3b82f6] text-xl font-bold text-white">w</span>
        <SessionBootstrap language={language} />
      </div>
    );
  }

  const [friends, requests] = await Promise.all([listFriends(user.id), listIncomingRequests(user.id)]);

  return <FriendsScreen friends={friends} requests={requests} />;
}
