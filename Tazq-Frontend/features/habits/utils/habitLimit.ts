/**
 * ALIŞKANLIK SINIRI (madde 6) — aynı anda en çok 7 aktif alışkanlık, modlarınkiler dahil.
 *
 * Neden 7: çalışan bellek aynı anda yaklaşık 7±2 öğeyi izleyebilir (Miller); alışkanlık
 * araştırmaları da az sayıda alışkanlığa odaklananların tutarlılığının daha yüksek
 * olduğunu söyler. Liste uzadıkça her biri "bugün yapmasam da olur" olur. Sınır bir
 * yasak değil bir odak kuralı: fazlası SİLİNMEZ, "dinlendirilir" (duraklatılır) —
 * geçmişi ve serisi korunur, tek dokunuşla geri gelir.
 */
import type { Habit } from '@/features/habits/store/useHabitStore';

/*
  İKİ AYRI HESAP (2026-11-05, kullanıcı: "3 mod açılsa limit doluyor, manuel ekleyemez; ayrım lazım").
  KİŞİSEL: 7 hak yalnız kullanıcının, hedefler bundan yemez.
  HEDEF RUTİNİ: hedef başına en çok 2. Otomatik ekleme genel bütçeye uyar ki hedefler günü boğmasın, ama bütçe hiçbir hedefi rutinsiz bırakmaz (bütçe en az hedef sayısı kadardır).
  ELLE EKLEME: kullanıcı kendi hedefine bilerek ekliyorsa yalnız hedef başına sınır geçerlidir; bütçe onun seçimini engellemez.
*/
export const HABIT_LIMIT = 7;
export const MODE_ROUTINE_PER_MODE = 2;
export const MODE_ROUTINE_TOTAL = 4;

type HabitRef = Pick<Habit, 'pausedAt'> & Partial<Pick<Habit, 'id' | 'planMode'>>;

/** Alışkanlığın modu (exam2 → exam; eski kayıtlarda kimlik öneki); kişiselse null. */
export function modeOf(h: { id?: string; planMode?: string | null }): string | null {
  const raw = h.planMode || h.id?.match(/^habit_(ramazan|yks|kpss|exam|tez|mulakat|spor|tasarruf|birakma)_/)?.[1];
  if (!raw) return null;
  const base = raw.replace(/\d+$/, '');
  return base === 'yks' || base === 'kpss' ? 'exam' : base;
}

/** Dinlenmeyen (aktif) alışkanlıklar. `pausedAt: null` = dinlendirmeden çıkarılmış → aktif. */
export const activeHabits = <T extends Pick<Habit, 'pausedAt'>>(habits: T[]): T[] => habits.filter(h => !h.pausedAt);

/** Sınıra kadar kaç alışkanlık daha eklenebilir (0 = dolu; sınır üstündeyse de 0). */
export const roomLeft = (habits: HabitRef[]): number => Math.max(0, HABIT_LIMIT - activeHabits(habits).filter(h => !modeOf(h)).length);

const familyOf = (mode: string) => { const b = mode.replace(/\d+$/, ''); return b === 'yks' || b === 'kpss' ? 'exam' : b; };

/** Kullanıcı bu hedefe elle kaç rutin daha ekleyebilir: yalnız hedef başına sınır. */
export function manualRoutineRoom(habits: HabitRef[], mode: string): number {
  const own = activeHabits(habits).map(modeOf).filter(m => m === familyOf(mode)).length;
  return Math.max(0, MODE_ROUTINE_PER_MODE - own);
}

/** Otomatik ekleme için yer: genel bütçeye uyar, ama hiç rutini olmayan hedefe en az bir yer kalır. */
export function modeRoomLeft(habits: HabitRef[], mode: string): number {
  const active = activeHabits(habits).map(modeOf).filter(Boolean) as string[];
  const room = manualRoutineRoom(habits, mode);
  const own = active.filter(m => m === familyOf(mode)).length;
  return Math.min(room, Math.max(own === 0 ? 1 : 0, MODE_ROUTINE_TOTAL - active.length));
}

/** Sınır üstündeki mod rutinlerinden dinlendirilecekler: son iki haftada en az yapılanlar. Hiçbir hedefin son rutini dinlenmez. */
export function routinesToRest<T extends Pick<Habit, 'id' | 'pausedAt' | 'completedDates' | 'createdAt'> & Partial<Pick<Habit, 'planMode'>>>(habits: T[], today: Date = new Date()): T[] {
  const routines = activeHabits(habits).filter(h => modeOf(h));
  const out = new Set<T>();
  for (const mode of new Set(routines.map(h => modeOf(h) as string))) {
    const own = routines.filter(h => modeOf(h) === mode);
    restSuggestions(own, own.length - MODE_ROUTINE_PER_MODE, today).forEach(h => out.add(h));
  }
  const left = routines.filter(h => !out.has(h));
  const budget = Math.max(MODE_ROUTINE_TOTAL, new Set(left.map(h => modeOf(h))).size);
  let extra = left.length - budget;
  for (const h of restSuggestions(left, left.length, today)) {
    if (extra <= 0) break;
    const kept = left.filter(x => !out.has(x) && modeOf(x) === modeOf(h)).length;
    if (kept <= 1) continue;
    out.add(h);
    extra--;
  }
  return [...out];
}

const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Dinlendirmeye en uygun `count` alışkanlık: son 14 günde EN AZ yapılanlar (eşitlikte en yeni eklenen). */
export function restSuggestions<T extends Pick<Habit, 'id' | 'pausedAt' | 'completedDates' | 'createdAt'>>(habits: T[], count: number, today: Date = new Date()): T[] {
  const window = new Set(Array.from({ length: 14 }, (_, i) => keyOf(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i))));
  const score = (h: T) => (h.completedDates ?? []).filter(d => window.has(d)).length;
  return activeHabits(habits)
    .map((h, i) => ({ h, s: score(h), i }))
    .sort((a, b) => a.s - b.s || (b.h.createdAt ?? '').localeCompare(a.h.createdAt ?? '') || a.i - b.i)
    .slice(0, Math.max(0, count))
    .map(x => x.h);
}

/** [from, to) aralığındaki günler ('YYYY-MM-DD'). */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  while (d < end) { out.push(keyOf(d)); d.setDate(d.getDate() + 1); }
  return out;
}
