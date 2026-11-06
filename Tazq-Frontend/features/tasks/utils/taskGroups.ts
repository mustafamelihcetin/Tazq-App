import { calendarDayOf, toDateKey } from '@/shared/utils/dateKey';
import { isSomeday } from '@/features/tasks/utils/taskTags';
import type { AppLang } from '@/shared/utils/lang';

/*
  GÖREV LİSTESİ BÖLÜMLERİ (2026-11-06). Liste düz akıyordu ve her satır "· Bugün" diye kendi gününü tekrar ediyordu.
  Fikir Tasks.org'un SectionedDataSource'undan: düz görev sırası + araya giren başlıklar, tamamlananlar en altta.
  Düz sıra (`flat`) taşıma ve toplu seçimin kullandığı sıra olarak kalır; başlıklar yalnız çizimde vardır.
*/
export type TaskGroupId = 'overdue' | 'today' | 'tomorrow' | 'soon' | 'anytime' | 'someday' | 'high' | 'medium' | 'low' | 'later' | 'done' | 'all';
export type TaskGroupMode = 'date' | 'priority' | 'none';

interface GroupableTask { id: number; isCompleted: boolean; dueDate?: string | null; priority?: string; tags?: string[] | null }

export interface TaskCell<T> {
  task: T;
  /** `flat` içindeki sıra: taşıma bununla çalışır. */
  index: number;
  group: TaskGroupId;
  /** Tek sütunda bölüm içindeki yer; ızgarada her görev kendi kartıdır. */
  position?: 'only' | 'first' | 'middle' | 'last';
  /** Komşusu aynı bölümde mi: başka güne geçiren "yukarı taşı" sıra değil, yalan olurdu. */
  canUp: boolean;
  canDown: boolean;
}

export type TaskRow<T> =
  | { kind: 'header'; key: string; group: TaskGroupId; label: string; count: number }
  | { kind: 'later'; key: string }
  | { kind: 'cells'; key: string; cells: TaskCell<T>[] };

const COPY: Record<AppLang, Partial<Record<TaskGroupId, string>>> = {
  tr: { overdue: 'Gecikmiş', today: 'Bugün', tomorrow: 'Yarın', soon: 'Yakında', anytime: 'Tarihsiz', someday: 'Belki Bir Gün', high: 'Yüksek öncelik', medium: 'Orta öncelik', low: 'Düşük öncelik', done: 'Tamamlanan' },
  en: { overdue: 'Overdue', today: 'Today', tomorrow: 'Tomorrow', soon: 'Coming up', anytime: 'No date', someday: 'Someday', high: 'High priority', medium: 'Medium priority', low: 'Low priority', done: 'Completed' },
};

const ORDER: Record<Exclude<TaskGroupMode, 'none'>, TaskGroupId[]> = {
  date: ['overdue', 'today', 'tomorrow', 'soon', 'anytime', 'someday'],
  priority: ['high', 'medium', 'low'],
};

const plusDay = (now: Date) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

/** Açık bir görevin tarih bölümü. Gecikme tanımı `matchesTaskFilter`la aynı: takvim günü bugünden önce. */
export function dateGroupOf(t: GroupableTask, now: Date = new Date()): TaskGroupId {
  if (isSomeday(t)) return 'someday';
  const day = calendarDayOf(t.dueDate);
  if (!day) return 'anytime';
  const today = toDateKey(now);
  if (day < today) return 'overdue';
  if (day === today) return 'today';
  return day === toDateKey(plusDay(now)) ? 'tomorrow' : 'soon';
}

const priorityGroupOf = (t: GroupableTask): TaskGroupId => (t.priority === 'High' ? 'high' : t.priority === 'Low' ? 'low' : 'medium');

/**
 * Görünen görevlerden çizim satırlarını üretir.
 * @param exiting Tamamlanma animasyonu süren görevler: animasyon bitene dek YERİNDE kalır, sonra "Tamamlanan"a iner.
 */
export function buildTaskRows<T extends GroupableTask>(
  near: T[],
  later: T[],
  opts: { mode: TaskGroupMode; cols: number; laterCount: number; exiting: ReadonlySet<number>; lang: AppLang; now?: Date },
): { flat: T[]; rows: TaskRow<T>[] } {
  const { mode, cols, laterCount, exiting, lang, now = new Date() } = opts;
  const buckets = new Map<TaskGroupId, T[]>();
  const put = (g: TaskGroupId, t: T) => { const b = buckets.get(g); if (b) b.push(t); else buckets.set(g, [t]); };
  for (const t of near) {
    if (mode === 'none') put('all', t);
    else if (t.isCompleted && !exiting.has(t.id)) put('done', t);
    else put(mode === 'date' ? dateGroupOf(t, now) : priorityGroupOf(t), t);
  }
  const flat: T[] = [];
  const rows: TaskRow<T>[] = [];
  const emit = (group: TaskGroupId, tasks: T[]) => {
    const start = flat.length;
    const cells = tasks.map((task, i): TaskCell<T> => ({
      task, group, index: start + i, canUp: i > 0, canDown: i < tasks.length - 1,
      position: cols > 1 ? undefined : tasks.length === 1 ? 'only' : i === 0 ? 'first' : i === tasks.length - 1 ? 'last' : 'middle',
    }));
    flat.push(...tasks);
    for (let i = 0; i < cells.length; i += cols) {
      const chunk = cells.slice(i, i + cols);
      rows.push({ kind: 'cells', key: `${cols > 1 ? `g-${group}-` : 't-'}${chunk[0].task.id}`, cells: chunk });
    }
  };
  const section = (group: TaskGroupId) => {
    const tasks = buckets.get(group);
    if (!tasks?.length) return;
    rows.push({ kind: 'header', key: `h-${group}`, group, label: COPY[lang][group] ?? '', count: tasks.length });
    emit(group, tasks);
  };

  if (mode === 'none') { const all = buckets.get('all'); if (all) emit('all', all); }
  else ORDER[mode].forEach(section);
  if (laterCount > 0 && rows.length > 0) rows.push({ kind: 'later', key: 'later-toggle' });
  if (later.length) emit('later', later);
  if (mode !== 'none') section('done');
  return { flat, rows };
}
