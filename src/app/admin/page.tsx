import { notFound } from "next/navigation";

import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { BackButton } from "@/components/back-button";
import { isAdmin } from "@/lib/admin/auth";
import { getAdminStats } from "@/lib/admin/stats";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) notFound(); // hide existence from non-admins
  const stats = await getAdminStats();
  return (
    <>
      <BackButton href="/settings" />
      <AdminDashboard stats={stats} />
    </>
  );
}
