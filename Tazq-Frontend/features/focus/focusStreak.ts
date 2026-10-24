import { sessionDayKey } from '@/features/report/weeklyReport';
import { toDateKey } from '@/shared/utils/dateKey';

/**
 * Son N günün odak dakikaları + seri — odak ekranındaki mini şerit için.
 *
 * Gün kuralı Haftalık Geri Bakış'la AYNI (`sessionDayKey`): iki ekran aynı günü
 * farklı saymasın. Bugün için yerel sayaç da hesaba katılır (`todayLocal`): seans
 * daha sunucuya yazılmadan biten dakikalar şeritte görünsün.
 *
 * SERİ: bugün henüz odak yoksa seri DÜNDEN sayılır — gün bitmeden "kırıldı" demek
 * motivasyonu cezalandırır (Duolingo/Apple Fitness aynı kuralı izler).
 */
export interface FocusDay { key: string; minutes: number; isToday: boolean }

export function recentFocus(
  sessions: ReadonlyArray<{ startedAt: string; minutes: number }>,
  todayLocal: number,
  now: Date = new Date(),
  count = 7,
): { days: FocusDay[]; streak: number } {
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    const k = sessionDayKey(s.startedAt);
    if (k) byDay.set(k, (byDay.get(k) ?? 0) + Math.max(0, s.minutes || 0));
  }
  const keyAt = (offset: number) => {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0); // öğlen: gün sınırı/yaz saati kaymasına bağışık
    d.setDate(d.getDate() - offset);
    return toDateKey(d);
  };
  const todayKey = keyAt(0);
  byDay.set(todayKey, Math.max(byDay.get(todayKey) ?? 0, todayLocal));

  const days: FocusDay[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const key = keyAt(i);
    days.push({ key, minutes: byDay.get(key) ?? 0, isToday: i === 0 });
  }

  let streak = 0;
  let offset = (byDay.get(todayKey) ?? 0) > 0 ? 0 : 1;
  while ((byDay.get(keyAt(offset)) ?? 0) > 0) { streak++; offset++; }
  return { days, streak };
}
