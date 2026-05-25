import { Card } from "@/components/ui/card";

export function LoadingState({
  title = "Opening wheno",
  description = "Getting everything ready for your group.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Card className="flex flex-col items-center gap-5 py-10 text-center">
      <div className="relative flex h-14 w-14 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-border border-t-foreground" />
        <div className="h-7 w-7 rounded-full bg-card-muted" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted">{description}</p>
      </div>
    </Card>
  );
}
