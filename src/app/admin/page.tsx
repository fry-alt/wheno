import { notFound } from "next/navigation";

import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { isAdmin } from "@/lib/admin/auth";
import { getAdminStats } from "@/lib/admin/stats";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) notFound(); // hide existence from non-admins
  const stats = await getAdminStats();
  return <AdminDashboard stats={stats} />;
}
