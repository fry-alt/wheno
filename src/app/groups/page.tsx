import Link from "next/link";

import { DarkShell } from "@/components/dark-shell";
import { GroupCard } from "@/components/group-card";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { getCurrentUser } from "@/lib/auth";
import { getGroupsForUser } from "@/lib/db/queries";
import { getUiPreferences } from "@/lib/preferences";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const user = await getCurrentUser();
  const { language } = await getUiPreferences();

  if (!user) {
    return (
      <DarkShell title="Группы" backHref="/calendar">
        <SessionBootstrap language={language} />
      </DarkShell>
    );
  }

  const groups = await getGroupsForUser(user.id);

  return (
    <DarkShell
      title="Группы"
      backHref="/calendar"
      action={
        <Link
          href="/groups/new"
          className="flex h-9 items-center rounded-full bg-white px-4 text-sm font-semibold text-black"
        >
          + Создать
        </Link>
      }
    >
      {groups.length > 0 ? (
        <div className="space-y-3">
          {groups.map((group) => (
            <GroupCard group={group} key={group.id} language={language} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#2a2a2a] px-4 py-8 text-center">
          <p className="text-sm font-semibold text-white">Нет групп</p>
          <p className="mt-1 text-xs text-[#555]">Создай группу или вступи по коду</p>
        </div>
      )}
      <Link
        href="/join"
        className="flex h-12 w-full items-center justify-center rounded-xl bg-[#1a1a1a] text-sm font-semibold text-[#999]"
      >
        Вступить по коду
      </Link>
    </DarkShell>
  );
}
