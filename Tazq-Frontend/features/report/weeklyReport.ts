import { toDateKey, parseDateKey, calendarDayOf } from '@/shared/utils/dateKey';

/**
 * HAFTALIK ÖZET — Kokpit ile Geri Bakış'ın ORTAK hesabı.
 *
 * ── NEDEN TEK MODÜL ─────────────────────────────────────────────────────────
 * Aynı hafta iki ekranda AYRI AYRI hesaplanıyordu: Kokpit yerel görevlerden (yalnız
 * kişisel görevler), rapor ise sunucudan (tüm görevler, üstelik farklı tanımla). Yani
 * iki ekran aynı hafta için farklı sayı gösterebiliyordu ve kullanıcı hangisine
 * güveneceğini bilemiyordu. Sayının tanımı artık tek yerde.
 *
 * ── GÜN = YEREL GÜN ─────────────────────────────────────────────────────────
 * Sunucu günleri UTC'ye göre kırıyordu: Türkiye'de gece 00:30'da yapılan odak bir
 * önceki güne yazılıyordu. Kırılım burada, kullanıcının takvim gününe göre yapılır.
 *
 * ── GÖREV = TAMAMLANDIĞI GÜN ────────────────────────────────────────────────
 * Sunucu görevleri VADE gününe göre sayıyordu: dün vadeli işi bugün bitirince bugüne
 * yazılmıyordu ve tarihsiz görevler hiç sayılmıyordu. Burada ölçü "ne zaman bitirdin".
 * `completedAt` yoksa (eski kayıt) vade günü yedek olarak kullanılır.
 */

export const WEEK_DAYS = 7;

export interface FocusSessionRow {
  /** ISO — sunucudaki seans başlangıcı (UTC). Yerel güne burada çevrilir. */
  startedAt: string;
  minutes: number;
}

export interface ReportTask {
  isCompleted: boolean;
  completedAt?: string | null;
  dueDate?: string | null;
  /** Mod/plan görevlerini ayırmak için (bkz. planProgress). */
  tags?: string[] | null;
}

export interface ReportHabit {
  id: string;
  name?: string;
  completedDates?: string[];
  skippedDates?: string[];
  createdAt?: string;
}

export interface WeekRange {
  /** Haftanın 7 yerel gün anahtarı (Pazartesi → Pazar). */
  days: string[];
  startKey: string;
  endKey: string;
}

export interface WeekSummary {
  range: WeekRange;
  focusPerDay: number[];
  tasksPerDay: number[];
  habitDonePerDay: number[];
  totalFocusMin: number;
  totalTasks: number;
  /** Alışkanlık tamamlama oranı — payda GEÇEN günlerle sınırlı (bkz. habitDenominator). */
  habitPct: number;
  /** Odak yapılan gün sayısı. */
  activeDays: number;
  /** En çok odaklanılan günün sırası (0-6), odak yoksa -1. */
  bestDayIndex: number;
}

export interface PlanProgress {
  /** Bu haftaya planlanmış mod görevi sayısı. */
  total: number;
  done: number;
}

export interface WeekDelta {
  focusMin: number;
  tasks: number;
  /** Önceki haftada hiç veri yoksa kıyas yapılmaz. */
  comparable: boolean;
}

/** Pazartesi başlangıçlı haftanın ilk günü — YEREL. */
export function startOfWeek(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (date.getDay() + 6) % 7; // Pazartesi = 0
  date.setDate(date.getDate() - diff);
  return date;
}

/** `offset`: 0 bu hafta, -1 geçen hafta … */
export function weekRange(now: Date, offset = 0): WeekRange {
  const start = startOfWeek(now);
  start.setDate(start.getDate() + offset * WEEK_DAYS);
  const days: string[] = [];
  for (let i = 0; i < WEEK_DAYS; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    days.push(toDateKey(d));
  }
  return { days, startKey: days[0], endKey: days[WEEK_DAYS - 1] };
}

/** Seansın YEREL günü — sunucu UTC damgası cihazın takvimine çevrilir. */
export function sessionDayKey(startedAt: string): string | null {
  const d = new Date(startedAt);
  if (Number.isNaN(d.getTime())) return null;
  return toDateKey(d);
}

/** Görevin sayılacağı gün: bitirildiği gün; yoksa (eski kayıt) vade günü. */
export function taskDayKey(task: ReportTask): string | null {
  if (!task.isCompleted) return null;
  if (task.completedAt) {
    const d = new Date(task.completedAt);
    if (!Number.isNaN(d.getTime())) return toDateKey(d);
  }
  return calendarDayOf(task.dueDate);
}

/**
 * Alışkanlık oranının PAYDASI — yalnız YAŞANMIŞ günler.
 *
 * Eskiden payda "alışkanlık sayısı × 7" idi: salı günü bakan kullanıcı, her şeyi
 * yapmış olsa bile %29 görüyordu. Üstelik alışkanlık hafta ortasında kurulduysa
 * kurulmadan önceki günler de ondan bekleniyordu.
 */
export function habitDenominator(habits: ReportHabit[], days: string[], todayKey: string): number {
  let total = 0;
  for (const h of habits) {
    const created = h.createdAt ? toDateKey(new Date(h.createdAt)) : null;
    for (const day of days) {
      if (day > todayKey) continue;                    // gelecek günler beklenmez
      if (created && day < created) continue;          // kurulmadan önce beklenmez
      total++;
    }
  }
  return total;
}

export interface SummarizeInput {
  sessions: FocusSessionRow[];
  tasks: ReportTask[];
  habits: ReportHabit[];
  range: WeekRange;
  now?: Date;
}

export function summarizeWeek({ sessions, tasks, habits, range, now = new Date() }: SummarizeInput): WeekSummary {
  const index = new Map(range.days.map((d, i) => [d, i]));
  const focusPerDay = new Array(WEEK_DAYS).fill(0);
  const tasksPerDay = new Array(WEEK_DAYS).fill(0);
  const habitDonePerDay = new Array(WEEK_DAYS).fill(0);

  for (const s of sessions ?? []) {
    const key = sessionDayKey(s.startedAt);
    const i = key != null ? index.get(key) : undefined;
    if (i !== undefined) focusPerDay[i] += Math.max(0, s.minutes || 0);
  }

  for (const t of tasks ?? []) {
    const key = taskDayKey(t);
    const i = key != null ? index.get(key) : undefined;
    if (i !== undefined) tasksPerDay[i] += 1;
  }

  for (const h of habits ?? []) {
    for (const day of h.completedDates ?? []) {
      const i = index.get(day);
      if (i !== undefined) habitDonePerDay[i] += 1;
    }
  }

  const totalFocusMin = focusPerDay.reduce((a, b) => a + b, 0);
  const totalTasks = tasksPerDay.reduce((a, b) => a + b, 0);
  const habitDone = habitDonePerDay.reduce((a, b) => a + b, 0);
  const denom = habitDenominator(habits ?? [], range.days, toDateKey(now));
  const habitPct = denom > 0 ? Math.min(100, Math.round((habitDone / denom) * 100)) : 0;

  let bestDayIndex = -1;
  let best = 0;
  focusPerDay.forEach((m, i) => { if (m > best) { best = m; bestDayIndex = i; } });

  return {
    range,
    focusPerDay,
    tasksPerDay,
    habitDonePerDay,
    totalFocusMin,
    totalTasks,
    habitPct,
    activeDays: focusPerDay.filter((m) => m > 0).length,
    bestDayIndex,
  };
}

/** Bu hafta − geçen hafta. Geçen hafta bomboşsa kıyas yapılmaz (yanıltıcı "+%100" olmasın). */
export function compareWeeks(current: WeekSummary, previous: WeekSummary | null): WeekDelta {
  if (!previous) return { focusMin: 0, tasks: 0, comparable: false };
  const hadData = previous.totalFocusMin > 0 || previous.totalTasks > 0;
  return {
    focusMin: current.totalFocusMin - previous.totalFocusMin,
    tasks: current.totalTasks - previous.totalTasks,
    comparable: hadData,
  };
}

/**
 * MOD PLANI İLERLEMESİ — haftanın "programlanmış" kısmı.
 *
 * Rapor yalnız serbest görevleri ve odağı gösteriyordu; dönemsel mod kullanan kullanıcı
 * (sınav, tez, spor…) planının bu hafta ne kadarını tamamladığını hiçbir yerde toplu
 * göremiyordu. Ölçü VADEDİR: plan görevleri güne programlanır, o gün yapılması beklenir.
 */
export function planProgress(tasks: ReportTask[], range: WeekRange, planTags: readonly string[]): PlanProgress {
  const inWeek = new Set(range.days);
  const tagSet = new Set(planTags);
  let total = 0;
  let done = 0;
  for (const t of tasks ?? []) {
    const tags = (t as { tags?: string[] }).tags ?? [];
    if (!tags.some((tag) => tagSet.has(tag))) continue;
    const day = calendarDayOf(t.dueDate);
    if (!day || !inWeek.has(day)) continue;
    total++;
    if (t.isCompleted) done++;
  }
  return { total, done };
}

// ── Anlatı ───────────────────────────────────────────────────────────────────
type Lang = 'tr' | 'en';

const DAY_NAMES: Record<Lang, string[]> = {
  tr: ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
};

const MONTHS: Record<Lang, string[]> = {
  tr: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

/**
 * Grafik altındaki kısa gün adları — sunucu "Mon/Tue" gönderiyordu, arayüz ilk iki
 * harfini kesiyordu; Türkçe kullanıcı "Mo, Tu, We" görüyordu.
 *
 * Türkçede iki harf YETMEZ: Pazartesi/Pazar ikisi de "Pa", Cuma/Cumartesi ikisi de
 * "Cu" olurdu — yani grafikte iki ayrı gün aynı görünürdü.
 */
const SHORT_DAYS: Record<Lang, string[]> = {
  tr: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};

export function shortDayLabels(lang: Lang): string[] {
  return SHORT_DAYS[lang];
}

/** "15 – 21 Eyl" — hangi haftaya bakıldığı başlıkta yazmalı. */
export function weekLabel(range: WeekRange, lang: Lang): string {
  const a = parseDateKey(range.startKey);
  const b = parseDateKey(range.endKey);
  const months = MONTHS[lang];
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${b.getDate()} ${months[b.getMonth()]}`;
  return `${a.getDate()} ${months[a.getMonth()]} – ${b.getDate()} ${months[b.getMonth()]}`;
}

const STORY = {
  tr: {
    empty: 'Bu hafta henüz kayıt yok. Tek bir seans bile hikâyeyi başlatır.',
    days: (n: number) => `${n} gün odaklandın`,
    best: (day: string) => `en iyi günün ${day}`,
    tasks: (n: number) => `${n} iş bitirdin`,
    up: (m: number) => `geçen haftaya göre ${m} dakika daha fazla`,
    down: (m: number) => `geçen haftaya göre ${m} dakika daha az`,
    same: 'geçen haftayla aynı tempodasın',
  },
  en: {
    empty: 'Nothing recorded this week yet. One session starts the story.',
    days: (n: number) => `You focused on ${n} day${n === 1 ? '' : 's'}`,
    best: (day: string) => `your best day was ${day}`,
    tasks: (n: number) => `you finished ${n} task${n === 1 ? '' : 's'}`,
    up: (m: number) => `${m} minutes more than last week`,
    down: (m: number) => `${m} minutes less than last week`,
    same: 'the same pace as last week',
  },
};

/**
 * HAFTANIN HİKÂYESİ — çıplak sayı yerine bir cümle.
 * "İlerliyorum" hissi kıyastan ve anlatıdan doğar; dört ayrı sayıdan değil.
 */
export function weekStory(summary: WeekSummary, delta: WeekDelta, lang: Lang): string {
  const c = STORY[lang];
  if (summary.totalFocusMin === 0 && summary.totalTasks === 0) return c.empty;

  const parts: string[] = [];
  if (summary.activeDays > 0) parts.push(c.days(summary.activeDays));
  if (summary.bestDayIndex >= 0) parts.push(c.best(DAY_NAMES[lang][summary.bestDayIndex]));
  if (summary.totalTasks > 0) parts.push(c.tasks(summary.totalTasks));
  if (delta.comparable) {
    if (delta.focusMin > 5) parts.push(c.up(delta.focusMin));
    else if (delta.focusMin < -5) parts.push(c.down(Math.abs(delta.focusMin)));
    else parts.push(c.same);
  }
  return `${parts.join(' · ')}.`;
}
