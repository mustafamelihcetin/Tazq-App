import type { CreateTaskPayload } from '@/shared/services/api';
import type { Priority, RecurrenceType } from '@/shared/services/api';
import type { Payment, PaymentRecurrence } from '@/features/payments/store/usePaymentsStore';
import { ARCHIVED_TAG, SOMEDAY_TAG } from '@/features/tasks/utils/taskTags';

/*
  YEDEĞİ GERİ YÜKLEME (2026-11-06). "Verilerimi indir"in JSON dosyasını okur; Loop'taki elle içe aktarma fikri.
  EKLER, ÜSTÜNE YAZMAZ: var olan kayda dokunmaz, zaten olanı tekrar eklemez. Dışa aktarma kimlik taşımadığı için aynılık içerikten
  anlaşılır: görevde başlık + tarih, alışkanlıkta ad, ödemede başlık + tutar.
  Dosya dışarıdan gelir: her alan doğrulanır, sınır dışı olan atlanır. Odak geçmişi, momentum, başarım eklenmez: bunlar kullanıcının
  o anki kaydıdır, dosyayla değişmemeli.
*/
export const RESTORE_MAX_BYTES = 10 * 1024 * 1024;
const MAX_RECORDS = 5000;
const MAX_TEXT = 500;

export interface RestoreTask {
  key: string;
  payload: CreateTaskPayload;
}
export interface RestoreHabit {
  name: string;
  doneOn: string[];
  restDays: string[];
}
export type RestorePayment = Omit<Payment, 'id' | 'lastPaidCycleKey'>;

export interface RestorePlan {
  tasks: RestoreTask[];
  habits: RestoreHabit[];
  payments: RestorePayment[];
  /** Zaten var olduğu ya da geçersiz olduğu için atlananlar. */
  skipped: number;
}

export type RestoreParse = { ok: true; plan: RestorePlan } | { ok: false; reason: 'format' };

export interface CurrentData {
  tasks: { title: string; dueDate?: string | null }[];
  habits: { name: string; nameTr?: string; nameEn?: string }[];
  payments: { title: string; amount: number }[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s.slice(0, MAX_TEXT) : null;
};
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v.slice(0, MAX_RECORDS) : []);
const norm = (s: string) => s.trim().toLocaleLowerCase('tr');
const day = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const time = (v: unknown): string | null => (typeof v === 'string' && /^\d{2}:\d{2}/.test(v) ? v : null);
const days = (v: unknown): string[] => list(v).map(day).filter((d): d is string => d != null);

const PRIORITY: Record<string, Priority> = { low: 'Low', medium: 'Medium', high: 'High' };
const REPEAT: Record<string, RecurrenceType> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
const PAY_REPEAT: Record<string, PaymentRecurrence> = { monthly: 'Monthly', quarterly: 'Quarterly', semiannual: 'SemiAnnual', yearly: 'Yearly', once: 'Once' };

const taskKey = (title: string, due: string | null) => `${norm(title)}|${due ?? ''}`;
const payKey = (title: string, amount: number) => `${norm(title)}|${amount}`;

function parseTask(raw: unknown): RestoreTask | null {
  if (!isRecord(raw)) return null;
  const title = text(raw.title);
  if (!title) return null;
  const due = day(raw.dueDate);
  const done = raw.status === 'completed';
  const tags = list(raw.tags).map(text).filter((t): t is string => t != null).slice(0, 20);
  if (raw.archived === true) tags.push(ARCHIVED_TAG);
  if (raw.someday === true) tags.push(SOMEDAY_TAG);
  const subtasks = list(raw.subtasks).flatMap((st) => {
    const stTitle = isRecord(st) ? text(st.title) : null;
    return stTitle && isRecord(st) ? [{ text: stTitle, done: st.done === true }] : [];
  });
  const repeat = typeof raw.repeat === 'string' ? REPEAT[raw.repeat] : undefined;
  return {
    key: taskKey(title, due),
    payload: {
      title,
      description: text(raw.notes) ?? '',
      dueDate: due,
      dueTime: time(raw.dueTime),
      isCompleted: done,
      priority: (typeof raw.priority === 'string' && PRIORITY[raw.priority]) || 'Medium',
      tags,
      subtasks,
      // Biten tekrarlı görev geri gelirken yeni tekrar başlatmasın.
      recurrence: done ? 'None' : repeat ?? 'None',
    },
  };
}

function parsePayment(raw: unknown): RestorePayment | null {
  if (!isRecord(raw)) return null;
  const title = text(raw.title);
  const amount = typeof raw.amount === 'number' && Number.isFinite(raw.amount) ? raw.amount : null;
  const dueDay = typeof raw.dayOfMonth === 'number' && raw.dayOfMonth >= 1 && raw.dayOfMonth <= 31 ? Math.floor(raw.dayOfMonth) : null;
  if (!title || amount == null || amount < 0 || amount > 1_000_000_000 || dueDay == null) return null;
  const nextDue = day(raw.nextDue);
  return {
    title,
    amount,
    dueDay,
    recurrence: (typeof raw.repeat === 'string' && PAY_REPEAT[raw.repeat]) || 'Monthly',
    nextDueDate: nextDue ? `${nextDue}T00:00:00` : null,
    category: text(raw.category),
    currency: text(raw.currency) as RestorePayment['currency'],
  } as RestorePayment;
}

/** Dosya metnini okur, mevcut veriyle karşılaştırır. Hiçbir şey yazmaz: önizleme bunu gösterir. */
export function parseBackup(content: string, current: CurrentData): RestoreParse {
  let pkg: unknown;
  try {
    pkg = JSON.parse(content);
  } catch {
    return { ok: false, reason: 'format' };
  }
  if (!isRecord(pkg) || pkg.format !== 'tazq-export') return { ok: false, reason: 'format' };

  let skipped = 0;
  const seenTasks = new Set(current.tasks.map((t) => taskKey(t.title, day(t.dueDate?.slice(0, 10)))));
  const seenHabits = new Set(current.habits.flatMap((h) => [h.name, h.nameTr, h.nameEn]).filter((n): n is string => !!n).map(norm));
  const seenPayments = new Set(current.payments.map((p) => payKey(p.title, p.amount)));

  const tasks: RestoreTask[] = [];
  for (const raw of list(pkg.tasks)) {
    const task = parseTask(raw);
    if (!task || seenTasks.has(task.key)) { skipped += 1; continue; }
    seenTasks.add(task.key);
    tasks.push(task);
  }

  const habits: RestoreHabit[] = [];
  for (const raw of list(pkg.habits)) {
    const name = isRecord(raw) ? text(raw.name) : null;
    if (!name || !isRecord(raw) || seenHabits.has(norm(name))) { skipped += 1; continue; }
    seenHabits.add(norm(name));
    habits.push({ name, doneOn: days(raw.doneOn), restDays: days(raw.restDays) });
  }

  const payments: RestorePayment[] = [];
  for (const raw of list(pkg.payments)) {
    const payment = parsePayment(raw);
    if (!payment || seenPayments.has(payKey(payment.title, payment.amount))) { skipped += 1; continue; }
    seenPayments.add(payKey(payment.title, payment.amount));
    payments.push(payment);
  }

  return { ok: true, plan: { tasks, habits, payments, skipped } };
}

export const planSize = (p: RestorePlan) => p.tasks.length + p.habits.length + p.payments.length;
