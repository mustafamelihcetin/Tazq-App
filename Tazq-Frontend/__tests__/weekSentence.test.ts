import { buildWeekSentence } from '@/features/week/weekSentence';
import type { WeekSeg } from '@/features/week/WeekPanel';

/**
 * HAFTALIK MERKEZ CÜMLESİ (2026-10-31 denetimi).
 *  · Boş hafta: "Hafta yeni başlıyor" Cumartesi günü de yazıyordu — gün bilmiyordu.
 *  · Sıfırlar mavi hapla vurgulanıyordu ("0 görev bitirdin; alışkanlıklarda %0") — moral bozan,
 *    bilgi taşımayan vurgu. Sıfır olan kısım cümleye girmez.
 *  · Süre "6sa15dk" boşluksuz yazılıyordu; uygulamanın geri kalanı "6 sa 15 dk".
 */
const plain = (segs: WeekSeg[]) => segs.map(s => (typeof s === 'string' ? s : `⟨${s.em}⟩`)).join('');
const W = (o: Partial<{ focusMin: number; tasks: number; habitPct: number; hasHabits: boolean; dayIndex: number }>) =>
  ({ focusMin: 0, tasks: 0, habitPct: 0, hasHabits: false, dayIndex: 5, ...o });

describe('buildWeekSentence — boş hafta', () => {
  it('Pazartesi/Salı: hafta yeni başlıyor', () => {
    expect(plain(buildWeekSentence(W({ dayIndex: 0 }), 'tr'))).toBe('Hafta yeni başlıyor — bir alışkanlık ya da kısa bir odakla aç.');
    expect(plain(buildWeekSentence(W({ dayIndex: 1 }), 'tr'))).toContain('Hafta yeni başlıyor');
  });
  it('hafta ortası ve sonu: "yeni başlıyor" DEMEZ', () => {
    expect(plain(buildWeekSentence(W({ dayIndex: 5 }), 'tr'))).toBe('Bu hafta henüz kayıt yok — bir alışkanlık ya da kısa bir odakla başla.');
    expect(plain(buildWeekSentence(W({ dayIndex: 5 }), 'en'))).toBe('Nothing logged this week yet — start with a habit or a short focus.');
  });
});

describe('buildWeekSentence — sıfırlar cümleye girmez', () => {
  it('yalnız odak', () => {
    expect(plain(buildWeekSentence(W({ focusMin: 14, hasHabits: true }), 'tr'))).toBe('Bu hafta ⟨14 dk⟩ odaklandın.');
  });
  it('yalnız görev', () => {
    expect(plain(buildWeekSentence(W({ tasks: 3 }), 'tr'))).toBe('Bu hafta ⟨3 görev⟩ bitirdin.');
  });
  it('yalnız alışkanlık', () => {
    expect(plain(buildWeekSentence(W({ habitPct: 40, hasHabits: true }), 'tr'))).toBe("Bu hafta alışkanlıklarının ⟨%40'ını⟩ yaptın.");
  });
  it('hepsi dolu — süre boşluklu', () => {
    expect(plain(buildWeekSentence(W({ focusMin: 375, tasks: 9, habitPct: 54, hasHabits: true }), 'tr')))
      .toBe("Bu hafta ⟨6 sa 15 dk⟩ odaklandın, ⟨9 görev⟩ bitirdin ve alışkanlıklarının ⟨%54'ünü⟩ yaptın.");
    expect(plain(buildWeekSentence(W({ focusMin: 375, tasks: 1, habitPct: 54, hasHabits: true }), 'en')))
      .toBe('This week you focused ⟨6h 15m⟩, finished ⟨1 task⟩ and kept ⟨54%⟩ of your habits.');
  });
});
