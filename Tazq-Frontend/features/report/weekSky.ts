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

export interface SkySession { startedAt: string; minutes: number; taskName?: string | null; pausedSeconds?: number | null }

export interface SkyStar {
  day: number;
  /** Tuval genişliğine göre 0..1. */
  x01: number;
  /** Tuval yüksekliğine göre 0..1 (0 = 05:00). */
  y01: number;
  /** 0..1 — çizim yarıçapa çevirir. */
  size: number;
  minutes: number;
  /** Kesintisiz mi? Null: bilinmiyor (eski kayıt). Işıltı haçı bunu anlatır. */
  clean: boolean | null;
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
      clean: s.pausedSeconds == null ? null : s.pausedSeconds === 0,
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

/*
  GÖKYÜZÜNÜN KARŞILIĞI (2026-11-05, kullanıcı: "bir tık daha anlam katalım, ayakları yere bassın").
  Güzel ama "ne işime yarar" sorusu yanıtsızdı. Yıldızların gerçek karşılığı: toplam süre, gün dökümü, geçen haftanın AYNI NOKTASIYLA kıyas.
  Yalnız ölçülen veri: önceki haftada seans yoksa ya da saatler bilinmiyorsa kıyas gösterilmez.
*/
export interface SkyDay { minutes: number; count: number; longest: number; firstAt: Date | null; tasks: Record<string, number>; named: number }
export interface SkyWeek { totalMinutes: number; count: number; days: SkyDay[]; /** Haftanın en çok süre alan işi; hiç ad yoksa null. */ top: { name: string; minutes: number } | null; /** Geçen haftanın aynı noktasına göre fark (dk); karşılaştıracak veri yoksa null. */ delta: number | null }

const shiftKey = (key: string, days: number) => {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
};

export function skyWeek(sessions: SkySession[], dayKeys: string[], todayKey: string | undefined, timed: boolean): SkyWeek {
  const days: SkyDay[] = dayKeys.map(() => ({ minutes: 0, count: 0, longest: 0, firstAt: null, tasks: {}, named: 0 }));
  const byTask: Record<string, number> = {};
  const index = new Map(dayKeys.map((k, i) => [k, i]));
  // Bugün bu haftadaysa kıyas bugüne kadar: yarım haftayı tam haftayla kıyaslamak haksız olur.
  const todayIdx = todayKey ? dayKeys.indexOf(todayKey) : -1;
  const upTo = todayIdx >= 0 ? todayIdx : dayKeys.length - 1;
  const prevKeys = new Set(dayKeys.slice(0, upTo + 1).map((k) => shiftKey(k, -7)));
  let prev = 0;
  let current = 0;
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    if (s.minutes <= 0 || Number.isNaN(d.getTime())) continue;
    const key = toDateKey(d);
    if (prevKeys.has(key)) prev += s.minutes;
    const i = index.get(key);
    if (i === undefined) continue;
    const day = days[i];
    day.minutes += s.minutes;
    day.count += 1;
    day.longest = Math.max(day.longest, s.minutes);
    if (!day.firstAt || d < day.firstAt) day.firstAt = d;
    const name = s.taskName?.trim();
    if (name) {
      day.tasks[name] = (day.tasks[name] ?? 0) + s.minutes;
      day.named += s.minutes;
      byTask[name] = (byTask[name] ?? 0) + s.minutes;
    }
    if (i <= upTo) current += s.minutes;
  }
  return {
    totalMinutes: days.reduce((n, x) => n + x.minutes, 0),
    count: days.reduce((n, x) => n + x.count, 0),
    days,
    delta: timed && prev > 0 ? current - prev : null,
    top: Object.entries(byTask).sort((a, b) => b[1] - a[1]).map(([name, minutes]) => ({ name, minutes }))[0] ?? null,
  };
}

const LINES = {
  tr: {
    dur: (h: number, m: number) => (h === 0 ? `${m} dk` : m === 0 ? `${h} sa` : `${h} sa ${m} dk`),
    top: (name: string, d: string) => `En çok: ${name} · ${d}`,
    other: 'Diğer',
    same: 'Geçen haftanın bu noktasıyla aynı',
    delta: (sign: string, d: string) => `Geçen haftanın bu noktasına göre ${sign}${d}`,
    empty: (day: string) => `${day} · seans yok`,
    day: (day: string, n: number, dur: string, longest: string, at: string | null) => `${day} · ${n} seans · ${dur}${n > 1 ? ` · en uzunu ${longest}` : ''}${at ? ` · ilki ${at}` : ''}`,
  },
  en: {
    dur: (h: number, m: number) => (h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`),
    top: (name: string, d: string) => `Most: ${name} · ${d}`,
    other: 'Other',
    same: 'Same as this point last week',
    delta: (sign: string, d: string) => `${sign}${d} vs this point last week`,
    empty: (day: string) => `${day} · no sessions`,
    day: (day: string, n: number, dur: string, longest: string, at: string | null) => `${day} · ${n} ${n === 1 ? 'session' : 'sessions'} · ${dur}${n > 1 ? ` · longest ${longest}` : ''}${at ? ` · first ${at}` : ''}`,
  },
};

export function skyDuration(minutes: number, lang: 'tr' | 'en'): string {
  const rounded = Math.round(minutes);
  return LINES[lang].dur(Math.floor(rounded / 60), rounded % 60);
}

export function skyDelta(delta: number | null, lang: 'tr' | 'en'): string | null {
  if (delta === null) return null;
  const rounded = Math.round(delta);
  if (rounded === 0) return LINES[lang].same;
  return LINES[lang].delta(rounded > 0 ? '+' : '−', skyDuration(Math.abs(rounded), lang));
}

/** Seçili günün dökümü. Saat bilinmiyorsa (timed false) saat yazılmaz. */
export function skyDayLine(day: SkyDay, dayKey: string, lang: 'tr' | 'en', timed: boolean): string {
  const name = COPY[lang].days[new Date(`${dayKey}T12:00:00`).getDay()];
  if (day.count === 0) return LINES[lang].empty(name);
  const at = timed && day.firstAt ? `${String(day.firstAt.getHours()).padStart(2, '0')}:${String(day.firstAt.getMinutes()).padStart(2, '0')}` : null;
  return LINES[lang].day(name, day.count, skyDuration(day.minutes, lang), skyDuration(day.longest, lang), at);
}

/** Haftanın en çok süre alan işi. */
export function skyTop(week: SkyWeek, lang: 'tr' | 'en'): string | null {
  return week.top ? LINES[lang].top(week.top.name, skyDuration(week.top.minutes, lang)) : null;
}

/** Günün işleri: en çok üçü; adsız süre varsa "Diğer". Hiç ad yoksa null. */
export function skyDayTasks(day: SkyDay, lang: 'tr' | 'en'): string | null {
  const rows = Object.entries(day.tasks).sort((a, b) => b[1] - a[1]);
  if (rows.length === 0) return null;
  const top = rows.slice(0, 3);
  const rest = day.minutes - top.reduce((n, [, m]) => n + m, 0);
  const parts = top.map(([name, m]) => `${name} ${skyDuration(m, lang)}`);
  if (rest > 0) parts.push(`${LINES[lang].other} ${skyDuration(rest, lang)}`);
  return parts.join(' · ');
}
