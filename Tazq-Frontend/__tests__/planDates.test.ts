import { formatPlanDate, isDatePast, daysLeftOf } from '@/features/modes/utils/planTaskOps';
import {
  checkStreakAchievement,
  checkMomentumAchievement,
  checkFocusAchievement,
} from '@/features/user/utils/achievements';

/**
 * PLAN TARİH MANTIĞI — sessiz bozulan sınıf.
 *
 * Bu fonksiyonlar hiç test edilmemişti ve tam burada gerçek bir hata yaşandı:
 * "Kilonu gir" görevinin tarihi geçmişti, kullanıcı kilosunu girdi, görev
 * tamamlanmadı. Tarih mantığı yanlış olduğunda uygulama ÇÖKMEZ — yalnızca yanlış
 * davranır ve kimse fark etmeden haftalarca sürer.
 *
 * ÜÇ SAATLİK GECE TOLERANSI (tasarım kararı): kullanıcı gece 01:00'de hâlâ "dünü"
 * yaşıyor sayılır, çünkü insanlar günü gece yarısında bitirmez. Gece yarısından sonra
 * bir görevi kapatmaya çalışan kişi "süresi geçti" duvarına toslamasın diye.
 *
 * SAAT NEDEN SABİTLENİYOR: ilk yazdığım hâl gerçek saati kullanıyordu ve 00:00–03:00
 * arasında KIRILIYORDU — tolerans tam o saatlerde devreye giriyor. Gündüz yeşil, gece
 * kırmızı yanan bir test, testsizlikten kötüdür: güveni bozar ve sonunda susturulur.
 */

const REAL_NOW = Date.now();

/** Saati bilinen bir ana sabitler. `hour` yerel saat. */
function freezeAt(y: number, m: number, d: number, hour: number) {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(y, m - 1, d, hour, 0, 0));
}

afterEach(() => {
  jest.setSystemTime(REAL_NOW);
  jest.useRealTimers();
});

describe('isDatePast — normal gündüz saati (14:00)', () => {
  beforeEach(() => freezeAt(2026, 7, 15, 14));

  it('boş/tanımsız tarih GEÇMİŞ SAYILMAZ', () => {
    // Tarihsiz görevin süresi yoktur; `true` dönseydi hepsi kırmızıya boyanırdı.
    expect(isDatePast(null)).toBe(false);
    expect(isDatePast(undefined)).toBe(false);
    expect(isDatePast('')).toBe(false);
  });

  it('dün ve öncesi geçmiştir', () => {
    expect(isDatePast('2026-07-14')).toBe(true);
    expect(isDatePast('2026-06-15')).toBe(true);
  });

  it('BUGÜN geçmiş DEĞİLDİR — günün sonuna kadar süre var', () => {
    expect(isDatePast('2026-07-15')).toBe(false);
  });

  it('gelecek geçmiş değildir', () => {
    expect(isDatePast('2026-07-16')).toBe(false);
    expect(isDatePast('2027-01-01')).toBe(false);
  });

  it('tam ISO damgasında yalnız TARİH kısmına bakar', () => {
    // Saat bilgisi karşılaştırmayı bozmamalı.
    expect(isDatePast('2026-07-14T23:59:59.000Z')).toBe(true);
    expect(isDatePast('2026-07-15T00:00:00.000Z')).toBe(false);
  });
});

/**
 * GECE TOLERANSININ KENDİSİ — asıl korunması gereken davranış.
 * Saat 01:00'de kullanıcı hâlâ bir önceki günü yaşıyor.
 */
describe('isDatePast — gece toleransı (01:00)', () => {
  beforeEach(() => freezeAt(2026, 7, 15, 1));

  it('gece yarısını yeni geçmişken DÜN hâlâ geçmiş sayılmaz', () => {
    // 01:00 − 3 saat = önceki gün 22:00 → "bugün" hâlâ 14 Temmuz.
    // Kullanıcı gece 1'de dünkü görevini kapatabilmeli.
    expect(isDatePast('2026-07-14')).toBe(false);
  });

  it('iki gün öncesi yine de geçmiştir — tolerans SINIRLI', () => {
    expect(isDatePast('2026-07-13')).toBe(true);
  });

  it('takvim günü olarak bugün de geçmiş değildir', () => {
    expect(isDatePast('2026-07-15')).toBe(false);
  });
});

describe('isDatePast — tolerans sınırı (03:00 sonrası)', () => {
  it('04:00te dün artık geçmiştir — tolerans bitti', () => {
    freezeAt(2026, 7, 15, 4);
    expect(isDatePast('2026-07-14')).toBe(true);
  });
});

describe('daysLeftOf', () => {
  beforeEach(() => freezeAt(2026, 7, 15, 14));

  it('geçmiş ve boş tarihte 0 — negatif gün diye bir şey yok', () => {
    // Negatif dönseydi "kalan 3 gün" yazan yerler "-3 gün" yazardı.
    expect(daysLeftOf(null)).toBe(0);
    expect(daysLeftOf('2026-07-10')).toBe(0);
  });

  it('bugün 0, yarın 1', () => {
    expect(daysLeftOf('2026-07-15')).toBe(0);
    expect(daysLeftOf('2026-07-16')).toBe(1);
  });

  it('uzak tarihte gün sayısı doğru', () => {
    expect(daysLeftOf('2026-07-22')).toBe(7);
    expect(daysLeftOf('2026-08-14')).toBe(30);
  });

  it('gün sayısı TAM SAYI — kesirli gün gösterilemez', () => {
    for (const d of ['2026-07-16', '2026-07-18', '2026-08-29']) {
      expect(Number.isInteger(daysLeftOf(d))).toBe(true);
    }
  });

  it('ay ve yıl sınırını doğru geçer', () => {
    // Klasik hata yeri: 31 Temmuz → 1 Ağustos, ve yıl dönümü.
    expect(daysLeftOf('2026-08-01')).toBe(17);
    expect(daysLeftOf('2027-07-15')).toBe(365);
  });
});

describe('formatPlanDate', () => {
  it('boş girdide boş metin — "Invalid Date" yazmaz', () => {
    expect(formatPlanDate(null, true)).toBe('');
    expect(formatPlanDate(undefined, false)).toBe('');
    expect(formatPlanDate('', true)).toBe('');
  });

  it('iki dilde de tarih üretir ve biçimler FARKLIDIR', () => {
    const iso = '2026-03-09T12:00:00.000Z';
    const tr = formatPlanDate(iso, true);
    const en = formatPlanDate(iso, false);
    expect(tr).toContain('2026');
    expect(en).toContain('2026');
    // TR sayısal (09.03.2026), EN ay kısaltmalı (09 Mar 2026).
    expect(tr).not.toBe(en);
  });
});

/**
 * BAŞARIM EŞİKLERİ — bir-fazla/bir-eksik hatasının klasik yeri.
 *
 * Eşikler `>=` ile ve YÜKSEKTEN ALÇAĞA sıralı yazılı. Sıra bozulursa 100 günlük seri
 * "3 gün" rozetini açar: kullanıcı için gülünç ve GERİ ALINAMAZ, çünkü rozet kalıcı.
 */
describe('başarım eşikleri', () => {
  it('eşiğin TAM üstünde açılır', () => {
    expect(checkStreakAchievement(3)?.id).toBe('streak_3');
    expect(checkStreakAchievement(7)?.id).toBe('streak_7');
    expect(checkStreakAchievement(14)?.id).toBe('streak_14');
    expect(checkStreakAchievement(30)?.id).toBe('streak_30');
    expect(checkStreakAchievement(100)?.id).toBe('streak_100');
  });

  it('eşiğin ALTINDA açılmaz', () => {
    expect(checkStreakAchievement(0)).toBeNull();
    expect(checkStreakAchievement(2)).toBeNull();
  });

  it('EN YÜKSEK eşik kazanır — sıra bozulursa burası kırılır', () => {
    expect(checkStreakAchievement(150)?.id).toBe('streak_100');
    expect(checkStreakAchievement(31)?.id).toBe('streak_30');
    expect(checkStreakAchievement(13)?.id).toBe('streak_7');
  });

  it('momentum ve odak da aynı kurala uyar', () => {
    expect(checkMomentumAchievement(0)).toBeNull();
    expect(checkMomentumAchievement(100)?.id).toBe('momentum_100');
    expect(checkFocusAchievement(0)).toBeNull();
    expect(checkFocusAchievement(100000)).not.toBeNull();
  });

  it('negatif değer çökertmez', () => {
    // Veri bozulmasında negatif gelebiliyor; rozet açılmamalı ama patlamamalı da.
    expect(checkStreakAchievement(-5)).toBeNull();
    expect(checkMomentumAchievement(-1)).toBeNull();
    expect(checkFocusAchievement(-1)).toBeNull();
  });
});
