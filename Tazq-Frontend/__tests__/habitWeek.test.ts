/**
 * Haftalık Merkez alışkanlık kartı: hedef/beklenen/geride ve kartın cümlesi.
 * 2026-10-26 Pazartesi … 2026-11-01 Pazar; "bugün" Cuma 30.
 */
import { habitWeek, habitWeekStory, ablativeTr } from '@/features/week/habitWeek';
import type { HabitLike } from '@/features/habits/utils/habitSchedule';

const WEEK = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
const TODAY = '2026-10-30';
const h = (name: string, p: HabitLike = {}) => ({ name, createdAt: '2026-09-01T09:00:00Z', completedDates: [], skippedDates: [], ...p });
const plain = (segs: ReturnType<typeof habitWeekStory>) => segs.map(s => (typeof s === 'string' ? s : `[${s.em}]`)).join('');
const dayName = (k: string) => ({ '2026-10-27': 'Salı', '2026-10-28': 'Çarşamba', '2026-10-29': 'Perşembe' } as Record<string, string>)[k] ?? k;

describe('hedef ve geride kalma', () => {
  it('her gün: bugün yapılmadıysa beklenmez; mola beklenmez', () => {
    const w = habitWeek(h('Su', { completedDates: ['2026-10-26', '2026-10-27'], skippedDates: ['2026-10-28'] }), WEEK, TODAY);
    expect(w).toMatchObject({ done: 2, goal: 7, expected: 3, behind: 1, lastDone: '2026-10-27' }); // Pzt Sal yapıldı, Çar mola, Per kaçtı
  });

  it('haftada N: kalan günler yetiştikçe geride sayılmaz', () => {
    expect(habitWeek(h('Koşu', { schedule: { kind: 'weekly', times: 3 } }), WEEK, TODAY).behind).toBe(0); // 3 gün kaldı, 3 gerek
    expect(habitWeek(h('Koşu', { schedule: { kind: 'weekly', times: 5 } }), WEEK, TODAY).behind).toBe(2);
  });
});

describe('hedef kurulduğu günden sayılır (2026-10-31, cihazda "bu hafta 0/7")', () => {
  it('Perşembe kurulan her günlük alışkanlığın bu haftaki hedefi 4 (Pe, Cu, Ct, Pa)', () => {
    expect(habitWeek(h('Araştırma', { createdAt: '2026-10-29T09:00:00Z' }), WEEK, TODAY).goal).toBe(4);
  });
  it('hafta başından önce kurulduysa hedef 7', () => {
    expect(habitWeek(h('Su'), WEEK, TODAY).goal).toBe(7);
  });
});

describe('kartın cümlesi', () => {
  it('en çok geride kalanı ve son yapıldığı günü söyler', () => {
    const list = [h('Su', { completedDates: WEEK.slice(0, 5) }), h('Okuma', { completedDates: ['2026-10-27'] })];
    expect(plain(habitWeekStory(list, WEEK, TODAY, 'tr', dayName))).toBe("[Okuma] Salı'dan beri aksıyor; bugün yaparsan toparlanır.");
  });

  it('eşit gerilikte DAHA UZUN süredir aksayanı söyler (2026-10-31, denetim)', () => {
    // İkisi de 2 gün geride; Yürüyüş en son Perşembe, Meditasyon en son Salı yapıldı.
    // Eskiden listedeki sıra kazanıyordu ("Yürüyüş Perşembe'den beri") — asıl aksayan Meditasyon.
    const list = [h('Yürüyüş', { completedDates: ['2026-10-27', '2026-10-29'] }), h('Meditasyon', { completedDates: ['2026-10-26', '2026-10-27'] })];
    expect(plain(habitWeekStory(list, WEEK, TODAY, 'tr', dayName))).toBe("[Meditasyon] Salı'dan beri aksıyor; bugün yaparsan toparlanır.");
  });

  it('hiç başlamadıysa "bugün bir kez yeter"', () => {
    expect(plain(habitWeekStory([h('Okuma')], WEEK, TODAY, 'tr', dayName))).toBe('[Okuma] bu hafta henüz başlamadı; bugün bir kez yeter.');
  });

  it('kimse geride değilse yolunda; hepsi hedefteyse tamam', () => {
    expect(plain(habitWeekStory([h('Su', { completedDates: WEEK.slice(0, 5) })], WEEK, TODAY, 'tr', dayName))).toBe('Alışkanlıklar yolunda — [Su] bu hafta 5/7.');
    expect(plain(habitWeekStory([h('Koşu', { schedule: { kind: 'weekly', times: 2 }, completedDates: WEEK.slice(0, 2) })], WEEK, TODAY, 'tr', dayName)))
      .toBe('Haftanın hedefi tamam: [1 alışkanlık] hedefine ulaştı.');
  });

  it('Türkçe ayrılma eki ünlü uyumuna uyar', () => {
    expect(['Perşembe', 'Salı', 'Pazar', 'Cuma', 'Pazartesi'].map(ablativeTr)).toEqual(["Perşembe'den", "Salı'dan", "Pazar'dan", "Cuma'dan", "Pazartesi'den"]);
  });
});
