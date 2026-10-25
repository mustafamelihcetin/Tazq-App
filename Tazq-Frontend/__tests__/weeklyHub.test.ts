import { focusDelta, formatMinutes, bestDayIndex } from '@/features/dashboard/utils/weeklyHub';

/**
 * İÇGÖRÜ MODALI — gösterdiği her sayı GERÇEK veriden (2026-10-25 değerlendirmesi).
 *
 * Eski modalda ölçülen sorunlar:
 *  · "Odak skoru" hiç sıfıra inmiyordu (Math.max(10, …)): hiçbir şey yapmayan %10 görüyordu.
 *  · Geçen hafta 0 dk iken trend "+%100" yazıyordu — sıfıra göre yüzde tanımsızdır.
 *  · Alışkanlık puanı MUTLAK sayıydı (10 tamamlama = tam puan): beş alışkanlığı olan iki günde doluyordu.
 *  · "Ritüel günlerinde odak %45 daha yüksek" cümlesi SABİT metindi, hiçbir hesaba dayanmıyordu.
 */

describe('focusDelta', () => {
  it('iki hafta da boşsa karşılaştırma yok', () => {
    expect(focusDelta(0, 0)).toEqual({ kind: 'none' });
  });

  it('geçen hafta kayıt yoksa yüzde UYDURULMAZ', () => {
    expect(focusDelta(40, 0)).toEqual({ kind: 'new' });
  });

  it('gerçek değişim yuvarlanmış yüzde', () => {
    expect(focusDelta(120, 100)).toEqual({ kind: 'change', pct: 20 });
    expect(focusDelta(50, 100)).toEqual({ kind: 'change', pct: -50 });
    expect(focusDelta(0, 60)).toEqual({ kind: 'change', pct: -100 });
  });
});

describe('formatMinutes', () => {
  it('saat ve dakikaya böler, dilde birimiyle', () => {
    expect(formatMinutes(200, 'tr')).toBe('3 sa 20 dk');
    expect(formatMinutes(200, 'en')).toBe('3h 20m');
  });

  it('tam saat ve saatin altı', () => {
    expect(formatMinutes(120, 'tr')).toBe('2 sa');
    expect(formatMinutes(45, 'tr')).toBe('45 dk');
    expect(formatMinutes(0, 'en')).toBe('0m');
  });
});

describe('bestDayIndex', () => {
  it('en çok odaklanılan gün; boş haftada yok', () => {
    expect(bestDayIndex([{ minutes: 10 }, { minutes: 50 }, { minutes: 30 }])).toBe(1);
    expect(bestDayIndex([{ minutes: 0 }, {}])).toBeNull();
    expect(bestDayIndex(undefined)).toBeNull();
  });
});

describe('sameSpanTotal — hafta ortasında adil kıyas', () => {
  const { sameSpanTotal } = require('@/features/dashboard/utils/weeklyHub');
  // Çarşamba (indeks 2): bu haftanın 3 günü, geçen haftanın 7 günüyle kıyaslanınca trend
  // hafta başında HEP eksi çıkıyordu. Kıyas geçen haftanın AYNI günlerine.
  it('geçen haftanın yalnız bugüne kadarki günleri toplanır', () => {
    expect(sameSpanTotal([10, 20, 30, 40, 50, 60, 70], 2)).toBe(60);
  });
  it('Pazar tüm haftayı, sınır dışı indeks güvenli', () => {
    expect(sameSpanTotal([1, 1, 1, 1, 1, 1, 1], 6)).toBe(7);
    expect(sameSpanTotal([5], 3)).toBe(5);
    expect(sameSpanTotal([], 0)).toBe(0);
  });
});
