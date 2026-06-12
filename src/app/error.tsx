"use client";

import { useEffect } from "react";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // No own <html>/<body> — render inside the themed root layout so errors don't
  // flash an unthemed white screen.
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center text-foreground">
      <p className="text-sm text-muted">Что-то пошло не так.</p>
      <button
        onClick={reset}
        className="rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground transition active:scale-95"
      >
        Попробовать снова
      </button>
    </div>
  );
}
