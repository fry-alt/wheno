import type { ReactNode } from "react";
import type { AdminStats } from "@/lib/admin/stats";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-2xl font-bold tabular-nums text-foreground">{value.toLocaleString("ru-RU")}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{title}</p>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </section>
  );
}

export function AdminDashboard({ stats }: { stats: AdminStats }) {
  return (
    <div className="flex flex-col gap-6 px-4 pt-5 pb-8 animate-[fadeRise_300ms_ease-out]">
      <h1 className="text-2xl font-bold text-foreground">📊 Админка</h1>

      <Section title="Рост">
        <Stat label="Всего юзеров" value={stats.usersTotal} />
        <Stat label="Новые за 24ч" value={stats.usersNew24h} />
        <Stat label="Новые за 7 дней" value={stats.usersNew7d} />
      </Section>

      <Section title="Вовлечённость">
        <Stat label="Активны за 24ч · DAU" value={stats.dau} />
        <Stat label="Активны за 7 дней · WAU" value={stats.wau} />
      </Section>

      <Section title="Контент">
        <Stat label="Событий всего" value={stats.eventsTotal} />
        <Stat label="Событий за 7 дней" value={stats.events7d} />
        <Stat label="Активностей всего" value={stats.activitiesTotal} />
        <Stat label="Активностей за 7 дней" value={stats.activities7d} />
        <Stat label="Вступлений в активности" value={stats.participations} />
      </Section>

      <Section title="Социалка + безопасность">
        <Stat label="Дружб" value={stats.friendsAccepted} />
        <Stat label="Заявок в ожидании" value={stats.requestsPending} />
        <Stat label="Встреч" value={stats.meetings} />
        <Stat label="Репортов" value={stats.reports} />
        <Stat label="Блокировок" value={stats.blocks} />
      </Section>

      <p className="text-center text-[10px] text-text-faint">Цифры обновляются при загрузке страницы · «активны» = заходили (по updated_at)</p>
    </div>
  );
}
