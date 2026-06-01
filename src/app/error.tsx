"use client";

import { useEffect } from "react";

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
    <html lang="ru">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0f0f0f] p-8 text-center text-white">
          <p className="text-sm text-[#999]">Что-то пошло не так.</p>
          <button
            onClick={reset}
            className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black"
          >
            Попробовать снова
          </button>
        </div>
      </body>
    </html>
  );
}
