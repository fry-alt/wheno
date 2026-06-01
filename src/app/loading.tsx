import { LoadingState } from "@/components/loading-state";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f0f]">
      <LoadingState description="Загружаем" title="wheno" />
    </div>
  );
}
