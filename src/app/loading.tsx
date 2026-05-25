import { AppShell } from "@/components/app-shell";
import { LoadingState } from "@/components/loading-state";

export default function Loading() {
  return (
    <AppShell
      description="Getting your groups and meeting requests ready."
      title="Opening wheno"
    >
      <LoadingState />
    </AppShell>
  );
}
