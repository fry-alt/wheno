"use client";

import { useEffect } from "react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <AppShell
          description="Something unexpected happened while loading this screen."
          title="We hit a snag"
        >
          <Card className="space-y-4 text-center">
            <p className="text-sm leading-6 text-slate-500">
              {error.message || "Please try again in a moment."}
            </p>
            <Button fullWidth onClick={reset}>
              Try again
            </Button>
          </Card>
        </AppShell>
      </body>
    </html>
  );
}
