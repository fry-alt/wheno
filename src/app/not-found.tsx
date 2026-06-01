import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0f0f0f] p-8 text-center text-white">
      <p className="text-sm text-[#999]">Страница не найдена.</p>
      <Link href="/calendar" className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black">
        На календарь
      </Link>
    </div>
  );
}
