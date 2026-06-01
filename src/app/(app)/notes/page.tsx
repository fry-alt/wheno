import { TaskList } from "@/components/notes/task-list";
import { DayNotes } from "@/components/notes/day-notes";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { getCurrentUser } from "@/lib/auth";
import { getTasks, getDayNotes } from "@/lib/notes/queries";
import { getUiPreferences } from "@/lib/preferences";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const user = await getCurrentUser();
  const { language } = await getUiPreferences();

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#3b82f6] text-xl font-bold text-white">w</span>
        <SessionBootstrap language={language} />
      </div>
    );
  }

  const [tasks, dayNotes] = await Promise.all([getTasks(user.id), getDayNotes(user.id)]);

  return (
    <div className="px-4 pt-5">
      <h1 className="mb-4 text-2xl font-bold text-white">Заметки</h1>
      <section className="mb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#555]">Задачи</p>
        <TaskList tasks={tasks} />
      </section>
      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#555]">На день</p>
        <DayNotes notes={dayNotes} />
      </section>
    </div>
  );
}
