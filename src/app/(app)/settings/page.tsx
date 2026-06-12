import { SettingsScreen } from "@/components/settings/settings-screen";
import { getUiPreferences } from "@/lib/preferences";
import { isAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { themePref, languagePref } = await getUiPreferences();
  const admin = await isAdmin();
  return <SettingsScreen themePref={themePref} languagePref={languagePref} isAdmin={admin} />;
}
