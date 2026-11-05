import { EID_DAYS, isEidDay, ramadanFrame, type RamadanFrame, type StudyRelief } from '@/features/modes/utils/ramadanBrain';
import { dayNum } from '@/features/studyplan/utils/scheduler';
import { getCurrentRamadanStatus, getRamadanRanges, statusOfPeriod, type RamadanPeriod, type RamadanStatus } from '@/shared/utils/ramadanDates';
import { canStaff } from '@/shared/utils/staffRoles';
import { dateKeyFromNow, parseDateKey, toDateKey } from '@/shared/utils/dateKey';

/*
  YÖNETİCİ ÖNİZLEMESİ (2026-11-05, kullanıcı: "ramazan modunu admin olarak açabileyim, userlar göremesin, admin yetkisiyle açtığım belli olsun").
  Takvim dışında Ramazan'ı denemek için hesaba özel sahte dönem. Rol her okumada sunucudan gelen kullanıcı rolüyle kontrol edilir: bayrak bir şekilde başka hesaba geçse bile çalışmaz.
  Tarih soran her yer buradan okur, böylece önizleme uygulamanın gerçek akışından geçer: görev üretimi, kart, Planım, otomatik kapanış.
*/
const PREVIEW_DAYS = 30;

const seasonalOf = () => require('@/features/modes/store/usePrefsStore').usePrefsStore.getState().seasonal as { ramazan?: boolean; ramazanPreviewStart?: string | null };
const roleOf = () => require('@/features/user/store/useAuthStore').useAuthStore.getState().user?.role as string | undefined;

export const canPreviewRamadan = (role: string | undefined) => canStaff(role, 'super');

export function previewPeriod(start: string): RamadanPeriod {
  const end = parseDateKey(start);
  end.setDate(end.getDate() + PREVIEW_DAYS - 1);
  return { year: parseDateKey(start).getFullYear(), start, end: toDateKey(end) };
}

/** Bugün önizlemenin n. günü olsun diye başlangıç. */
export const previewStartForDay = (n: number) => dateKeyFromNow(-(n - 1));

/** Etkin önizleme: açık + yönetici. */
export function activeRamadanPreview(): RamadanPeriod | null {
  const s = seasonalOf();
  if (!s.ramazan || !s.ramazanPreviewStart || !canPreviewRamadan(roleOf())) return null;
  return previewPeriod(s.ramazanPreviewStart);
}

export const isRamadanPreview = () => activeRamadanPreview() != null;

/** Önizleme varsa önde: `find` onu bulur. */
export function ramadanRangesNow(): { start: string; end: string }[] {
  const p = activeRamadanPreview();
  const real = getRamadanRanges();
  return p ? [{ start: p.start, end: p.end }, ...real] : real;
}

export function ramadanStatusNow(): RamadanStatus {
  const p = activeRamadanPreview();
  if (!p) return getCurrentRamadanStatus();
  return statusOfPeriod(p) ?? { period: null, isActive: false, daysRemaining: 0, daysUntilStart: 0, duration: 0 };
}

/** Planım ve satırların geri sayım tarihi: dönem sürüyorsa bitişi, başlamadıysa başlangıcı. */
export function ramadanGoalDate(): string | null {
  if (ramadanFrameNow().phase === 'eid') return null;
  const st = ramadanStatusNow();
  return st.period ? (st.isActive ? st.period.end : st.period.start) : null;
}

/** Ortak akılın girdisi: bugün düzen çalışıyor mu. Görev üretimi, Planım ve sınav takvimi aynı cevabı okur. */
export function ramadanFrameNow(): RamadanFrame {
  const st = ramadanStatusNow();
  const prefs = require('@/features/modes/store/usePrefsStore').usePrefsStore.getState();
  const spec = prefs.planSpecs?.ramazan;
  const today = toDateKey(new Date());
  return ramadanFrame({ modeOn: !!prefs.seasonal?.ramazan, isActive: st.isActive, daysRemaining: st.daysRemaining, notFasting: !!spec?.notFasting, notFastingToday: spec?.notFastingDay === today, isEid: isEidDay(today, ramadanRangesNow(), dayNum) });
}

/** Sınav planlayıcısına: mod açık ve kişi bu Ramazan oruçluysa dönem (başlamadan da: plan önceden bilsin). */
export function ramadanStudyRelief(): StudyRelief | null {
  const prefs = require('@/features/modes/store/usePrefsStore').usePrefsStore.getState();
  if (!prefs.seasonal?.ramazan || prefs.planSpecs?.ramazan?.notFasting) return null;
  const p = ramadanStatusNow().period;
  return p ? { start: p.start, end: p.end } : null;
}

/** Mod bu tarihe kadar açık kalır: bayram bitince kapanır, son gün değil. */
export function ramadanCloseAfter(rangeEnd: Date): Date {
  const e = new Date(rangeEnd);
  e.setDate(e.getDate() + EID_DAYS);
  e.setHours(23, 59, 59, 999);
  return e;
}
