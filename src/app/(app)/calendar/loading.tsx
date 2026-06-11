export default function CalendarLoading() {
  return (
    <div className="animate-pulse px-4 pt-4">
      <div className="mx-auto mb-4 h-9 w-48 rounded-full bg-card" />
      <div className="mb-3 flex items-center justify-between">
        <div className="h-9 w-9 rounded-full bg-card" />
        <div className="h-5 w-32 rounded bg-card" />
        <div className="h-9 w-9 rounded-full bg-card" />
      </div>
      <div className="grid grid-cols-7 gap-2 px-2">
        {Array.from({ length: 42 }).map((_, i) => (
          <div key={i} className="mx-auto h-8 w-8 rounded-full bg-card" />
        ))}
      </div>
      <div className="mt-5 flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-card" />
        ))}
      </div>
    </div>
  );
}
