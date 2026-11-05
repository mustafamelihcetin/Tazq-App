import { toDateKey } from '@/shared/utils/dateKey';

/*
  PLANIN KENDİ ÖLÇÜSÜ (2026-11-05, kullanıcı: "planım sayfası bomboş; hepsinin içi kendine göre olmalı"). Saf hesap: ekran bilmez, test edilir.
  Yalnız gerçekten kaydedilmiş veriden hesaplar; tartım yoksa ilerleme uydurmaz.
*/
export interface KiloProgress {
  start: number;
  target: number;
  latest: number;
  /** Yolun yüzdesi; ters yöne gidildiyse 0. */
  pct: number;
  leftKg: number;
  /** Eskiden yeniye, grafik için. */
  points: number[];
}

const TREND_POINTS = 8;
const round1 = (n: number) => Math.round(n * 10) / 10;

export function kiloProgress(startRaw: string, targetRaw: string, log: { date: string; weight: number }[]): KiloProgress | null {
  const start = parseFloat(startRaw.replace(',', '.'));
  const target = parseFloat(targetRaw.replace(',', '.'));
  if (!(start > 0) || !(target > 0) || start === target) return null;
  const ordered = [...log].sort((a, b) => a.date.localeCompare(b.date));
  const latest = ordered.length ? ordered[ordered.length - 1].weight : start;
  const done = start > target ? start - latest : latest - start;
  const pct = Math.max(0, Math.min(100, Math.round((done / Math.abs(start - target)) * 100)));
  return { start, target, latest, pct, leftKg: round1(Math.abs(latest - target)), points: ordered.slice(-TREND_POINTS).map(e => e.weight) };
}

/** Verilen günlerin hangisinde plan işi yapıldı. Boş tarih ve sunucunun sıfır tarihi ("0001-…") sayılmaz. */
export function activeDays(days: string[], habitDates: string[], completedAts: (string | null | undefined)[]): boolean[] {
  const done = new Set(habitDates);
  for (const at of completedAts) {
    if (!at || at.startsWith('0001')) continue;
    const d = new Date(at);
    if (!Number.isNaN(d.getTime())) done.add(toDateKey(d));
  }
  return days.map(k => done.has(k));
}
