import { toDateKey } from '@/shared/utils/dateKey';
import { partOf, type DayPart } from '@/shared/utils/dayPart';

export { partOf, type DayPart };

/*
  HAFTANIN GÖKYÜZÜ — MODEL (2026-11-01, v2). Çizim bileşeni (WeekSky) yalnız bunu çizer.

  Eskiden yıldızlar gün sütununda RASTGELE yükseklikteydi; kullanıcı "daha anlamlı olsun" dedi.
  Artık her öğe bir veriye karşılık gelir:
   · yıldız    = bir odak SEANSI
   · sütun     = gün
   · yükseklik = günün SAATİ (05:00 üstte → gece altta): haftanın deseni görünür
   · büyüklük  = seansın SÜRESİ
   · çizgi     = seanslar ZAMAN SIRASIYLA: haftanın gerçek yolu
  Eski sunucuda saat bilinmez (seans günlük toplamdan üretilir): yükseklik uydurulmaz, ortada durur.
*/

export interface SkySession { startedAt: string; minutes: number }

export interface SkyStar {
  day: number;
  /** Tuval genişliğine göre 0..1. */
  x01: number;
  /** Tuval yüksekliğine göre 0..1 (0 = 05:00). */
  y01: number;
  /** 0..1 — çizim yarıçapa çevirir. */
  size: number;
  minutes: number;
}

const DAY_START_HOUR = 5;

/** Saat → 0..1 (05:00 = 0, ertesi 04:59 ≈ 1). */
export function hourFrac(d: Date): number {
  const h = d.getHours() + d.getMinutes() / 60;
  return ((h - DAY_START_HOUR + 24) % 24) / 24;
}


/** Haftanın seansları, zaman sırasıyla, sütun ve yüksekliğiyle. `timed` false → saat bilinmiyor. */
export function skyStars(sessions: SkySession[], dayKeys: string[], timed: boolean): SkyStar[] {
  const index = new Map(dayKeys.map((k, i) => [k, i]));
  const rows = sessions
    .filter(s => s.minutes > 0)
    .map(s => ({ s, d: new Date(s.startedAt) }))
    .filter(({ d }) => !Number.isNaN(d.getTime()) && index.has(toDateKey(d)))
    .sort((a, b) => a.d.getTime() - b.d.getTime());

  const perDay = new Map<number, number>();
  const counts = new Map<number, number>();
  rows.forEach(({ d }) => { const day = index.get(toDateKey(d))!; counts.set(day, (counts.get(day) ?? 0) + 1); });

  return rows.map(({ s, d }) => {
    const day = index.get(toDateKey(d))!;
    const nth = perDay.get(day) ?? 0;
    perDay.set(day, nth + 1);
    const n = counts.get(day)!;
    // Aynı günün seansları sütun içinde yan yana açılır (üst üste binmesin); tek seans ortada.
    const within = n === 1 ? 0.5 : 0.25 + 0.5 * (nth / (n - 1));
    return {
      day,
      x01: (day + within) / dayKeys.length,
      y01: timed ? hourFrac(d) : 0.5,
      size: Math.min(1, Math.sqrt(s.minutes / 90)),
      minutes: s.minutes,
    };
  });
}

const COPY = {
  tr: {
    part: { morning: 'sabah', noon: 'öğleden sonra', evening: 'akşam', night: 'gece' } as Record<DayPart, string>,
    days: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
    most: (p: string) => `En çok ${p} odaklandın`,
    brightest: (d: string, first: boolean) => `${first ? 'En' : 'en'} parlak gün ${d}`,
  },
  en: {
    part: { morning: 'the morning', noon: 'the afternoon', evening: 'the evening', night: 'at night' } as Record<DayPart, string>,
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    most: (p: string) => `You focused most ${p.startsWith('at') ? p : `in ${p}`}`,
    brightest: (d: string, first: boolean) => `${first ? 'Brightest' : 'brightest'} day ${d}`,
  },
};

/** Haftanın tek cümlesi: en çok hangi vakit (saat biliniyorsa) · en parlak gün. Seans yoksa null. */
export function skyStory(sessions: SkySession[], dayKeys: string[], lang: 'tr' | 'en', timed: boolean): string | null {
  const stars = skyStars(sessions, dayKeys, timed);
  if (stars.length === 0) return null;
  const c = COPY[lang];
  const byDay = new Map<number, number>();
  const byPart = new Map<DayPart, number>();
  for (const st of stars) byDay.set(st.day, (byDay.get(st.day) ?? 0) + st.minutes);
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    if (s.minutes > 0 && dayKeys.includes(toDateKey(d))) byPart.set(partOf(d.getHours()), (byPart.get(partOf(d.getHours())) ?? 0) + s.minutes);
  }
  const bestDay = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const dayName = c.days[new Date(`${dayKeys[bestDay]}T12:00:00`).getDay()];
  if (!timed) return c.brightest(dayName, true);
  const bestPart = [...byPart.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return `${c.most(c.part[bestPart])} · ${c.brightest(dayName, false)}`;
}
