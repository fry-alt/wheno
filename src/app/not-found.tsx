import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";

export default function NotFound() {
  return (
    <AppShell
      description="The page you were looking for is not here anymore."
      title="Nothing to see here"
    >
      <EmptyState
        actionHref="/"
        actionLabel="Back home"
        description="The group or meeting may have moved, or you may need to join it first."
        title="We couldn't find that page"
      />
    </AppShell>
  );
}
