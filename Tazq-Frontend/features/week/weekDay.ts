import { scopeDay, scopeOtherDay } from '@/features/dashboard/utils/dayScope';

/*
  BİR GÜNÜN İŞLERİ (2026-11-05, kullanıcı: hafta sayfası karmaşa). Ana ekran "11 görev" derken Hafta "Görev yok" diyordu: burası plan işlerini hiç saymıyordu.
  Gün tanımı tek yerde (dayScope): ana ekran ve Günüm neyi sayıyorsa Hafta da onu sayar. Tarihsizler günün hedefine girmez.
*/
type DayTask = { dueDate?: string | null; isCompleted?: boolean; completedAt?: string | null; isArchived?: boolean; tags?: string[] };

export function tasksOnDay<T extends DayTask>(tasks: T[], key: string, today: string): T[] {
  const live = tasks.filter(t => !t.isArchived && !(t.tags ?? []).includes('archived'));
  const at = new Date(`${key}T12:00:00`);
  const scope = key === today ? scopeDay(live, at) : scopeOtherDay(live, at);
  return [...scope.incomplete, ...scope.completed];
}

/** Bitmemiş olan üstte, sıra kendi içinde sabit: işaretleyince satır parmağın altından kaçmaz, yalnız bir sonraki açılışta iner. */
export const openFirst = <T extends { isCompleted?: boolean }>(tasks: T[]): T[] => [...tasks.filter(t => !t.isCompleted), ...tasks.filter(t => t.isCompleted)];

export const WEEK_COPY = {
  tr: {
    title: 'Hafta',
    today: 'Bugün',
    more: (n: number) => `${n} iş daha`,
    empty: { today: 'Bugün için iş yok.', past: 'Bu gün iş yoktu.', future: 'Henüz iş yok. Plan işleri o gün gelir.' },
    priorityTitle: 'Bu haftanın önceliği',
    priorityHint: 'Seçtiğin hedef rotanda öne geçer.',
    choose: 'Seç',
    note: 'Notun',
    removeNote: 'Kaldır',
    calendar: 'Takvim',
    summary: 'Haftanın özeti',
    habits: 'Alışkanlıklar',
    ownHabits: 'Kendi alışkanlıkların',
    goalHabits: 'Hedeflerinden',
  },
  en: {
    title: 'Week',
    today: 'Today',
    more: (n: number) => `${n} more`,
    empty: { today: 'Nothing for today.', past: 'Nothing on this day.', future: 'Nothing yet. Plan work arrives on the day.' },
    priorityTitle: 'This week’s priority',
    priorityHint: 'The goal you pick moves up in your route.',
    choose: 'Pick',
    note: 'Your note',
    removeNote: 'Remove',
    calendar: 'Calendar',
    summary: 'Week summary',
    habits: 'Habits',
    ownHabits: 'Your own habits',
    goalHabits: 'From your goals',
  },
};
