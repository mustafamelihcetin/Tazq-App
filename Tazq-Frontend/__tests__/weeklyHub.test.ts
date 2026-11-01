import { formatMinutes, bestDayIndex } from '@/features/dashboard/utils/weeklyHub';

/**
 * İÇGÖRÜ MODALI — gösterdiği her sayı GERÇEK veriden (2026-10-25 değerlendirmesi).
 *
 * Eski modalda ölçülen sorunlar:
 *  · "Odak skoru" hiç sıfıra inmiyordu (Math.max(10, …)): hiçbir şey yapmayan %10 görüyordu.
 *  · Geçen hafta 0 dk iken trend "+%100" yazıyordu — sıfıra göre yüzde tanımsızdır.
 *  · Alışkanlık puanı MUTLAK sayıydı (10 tamamlama = tam puan): beş alışkanlığı olan iki günde doluyordu.
 *  · "Ritüel günlerinde odak %45 daha yüksek" cümlesi SABİT metindi, hiçbir hesaba dayanmıyordu.
 */


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

