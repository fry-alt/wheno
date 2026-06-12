"use client";

import { useEffect } from "react";

// Catches errors in the root layout itself. Must render its own <html>/<body>,
// so pin the dark theme + brand background to avoid a white flash.
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
    <html lang="ru" data-theme="dark">
      <body style={{ background: "#0e0e13", color: "#f4f4f7" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 32, textAlign: "center" }}>
          <p style={{ fontSize: 14, opacity: 0.7 }}>Что-то пошло не так.</p>
          <button
            onClick={reset}
            style={{ borderRadius: 12, background: "#5b7cfa", color: "#fff", padding: "8px 20px", fontSize: 14, fontWeight: 600, border: "none" }}
          >
            Попробовать снова
          </button>
        </div>
      </body>
    </html>
  );
}
