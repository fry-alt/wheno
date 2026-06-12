import { SettingsScreen } from "@/components/settings/settings-screen";
import { getUiPreferences } from "@/lib/preferences";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { themePref, languagePref } = await getUiPreferences();
  return <SettingsScreen themePref={themePref} languagePref={languagePref} />;
}
