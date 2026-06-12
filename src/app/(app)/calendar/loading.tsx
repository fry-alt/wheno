export default function CalendarLoading() {
  return (
    <div className="px-4 pt-4">
      <div className="skeleton mx-auto mb-4 h-9 w-48 rounded-full" />
      <div className="mb-3 flex items-center justify-between">
        <div className="skeleton h-9 w-9 rounded-full" />
        <div className="skeleton h-5 w-32 rounded" />
        <div className="skeleton h-9 w-9 rounded-full" />
      </div>
      <div className="grid grid-cols-7 gap-2 px-2">
        {Array.from({ length: 42 }).map((_, i) => (
          <div key={i} className="skeleton mx-auto h-8 w-8 rounded-full" />
        ))}
      </div>
      <div className="mt-5 flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-14 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
