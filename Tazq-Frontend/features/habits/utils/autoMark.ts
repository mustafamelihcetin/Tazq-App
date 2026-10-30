import { useHabitStore, fmtDateKey } from '@/features/habits/store/useHabitStore';
import { useToastStore } from '@/shared/store/useToastStore';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { MILESTONES, type HabitAutoSource } from '@/features/habits/utils/habitSchedule';

/**
 * OTOMATİK İŞARETLEME (2026-10-30) — odak/nefes seansı bitince bağlı alışkanlık kendiliğinden
 * dolar; kullanıcı hiçbir şey yapmaz, yalnız kısa bir onay görür. Sürtünmesiz işaretleme,
 * "gün gün işaretlemek angarya" sorununun en doğrudan çözümü.
 * Odakta eşik: tamamlanan seans ya da en az FOCUS_AUTO_MIN dakika — bir dakikalık deneme
 * "Ders çalış"ı doldurmasın.
 */
export const FOCUS_AUTO_MIN = 10;

const COPY = {
  tr: {
    one: (n: string) => `✓ ${n} işaretlendi`, many: (k: number) => `✓ ${k} alışkanlık işaretlendi`,
    milestone: { 7: (n: string) => `${n}: 7. tekrar — iyi bir başlangıç`, 21: (n: string) => `${n}: 21. tekrar — alışkanlık oturuyor`, 66: (n: string) => `${n}: 66. tekrar — artık otomatik` } as Record<number, (n: string) => string>,
  },
  en: {
    one: (n: string) => `✓ ${n} checked off`, many: (k: number) => `✓ ${k} habits checked off`,
    milestone: { 7: (n: string) => `${n}: 7 times — a good start`, 21: (n: string) => `${n}: 21 times — it's settling in`, 66: (n: string) => `${n}: 66 times — now it's automatic` } as Record<number, (n: string) => string>,
  },
};

const lang = () => COPY[useLanguageStore.getState().language === 'en' ? 'en' : 'tr'];

/**
 * KİLOMETRE TAŞI — toplam tekrar 7 / 21 / 66'ya o gün ulaştıysa tek seferlik kutlama. Toplam asla
 * düşmez: kaybedilebilir seri yerine biriken bir sayı (bkz. habitSchedule MILESTONES).
 */
export function celebrateMilestone(habitId: string, date: string = fmtDateKey()): number | null {
  const h = useHabitStore.getState().habits.find(x => x.id === habitId);
  if (!h || !(h.completedDates ?? []).includes(date)) return null;
  const total = (h.completedDates ?? []).length;
  if (!(MILESTONES as readonly number[]).includes(total)) return null;
  useToastStore.getState().show(lang().milestone[total](h.name), 'success');
  return total;
}

export function autoMarkHabits(source: HabitAutoSource): string[] {
  const names = useHabitStore.getState().markAuto(source, fmtDateKey());
  if (names.length > 0) {
    const c = lang();
    useToastStore.getState().show(names.length === 1 ? c.one(names[0]) : c.many(names.length), 'success');
  }
  return names;
}

export const focusQualifies = (minutes: number, completed: boolean) => completed || minutes >= FOCUS_AUTO_MIN;
