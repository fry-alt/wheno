import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center text-foreground">
      <p className="text-sm text-muted">Страница не найдена.</p>
      <Link href="/calendar" className="rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground">
        На календарь
      </Link>
    </div>
  );
}
