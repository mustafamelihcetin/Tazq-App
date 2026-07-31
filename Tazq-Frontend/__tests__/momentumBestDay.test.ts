import { isBestDayOfWeek } from '@/shared/utils/momentum';

/**
 * MOMENTUM GRAFİĞİNDEKİ PARILTININ KAPISI.
 *
 * Momentum kutusu açılış animasyonundan sonra donuyordu; içine "canlı" bir öğe istendi.
 * Süs eklemek kolaydı, doğrusu değildi — bu kod tabanında hareketin kuralı belli
 * (bkz. StatusHub nabzı, yalnız seans sürerken atar): HAREKET BİLGİ TAŞIR.
 *
 * Bu yüzden koşul bilerek NADİR seçildi. "Bugün hâlâ yükseltilebilir" gibi neredeyse her
 * zaman doğru bir koşul, sürekli yanan bir ışık demekti; sürekli yanan ışık bilgi değil
 * gürültüdür ve birkaç gün sonra göz onu görmez.
 *
 * Buradaki testlerin çoğu bir "kutlama"nın NE ZAMAN YAPILMAMASI gerektiğini sabitliyor.
 * Yanlış yerde patlayan bir kutlama, hiç olmayan kutlamadan daha çok zarar verir:
 * işaretin anlamını tüketir ve bir daha geri gelmez.
 */
describe('isBestDayOfWeek — haftanın en iyi günü parıltısı', () => {
  /** Grafikteki 7 gün, eskiden yeniye; son eleman bugün. Veri yoksa -1. */
  const week = (...scores: number[]) => scores;

  describe('parıldadığı durumlar', () => {
    it('bugün son yedi günün en iyisiyse', () => {
      expect(isBestDayOfWeek(week(40, 55, 30, 60, 45, 50, 82))).toBe(true);
    });

    it('bugün kendi rekorunu TEKRARLIYORSA da parıldar', () => {
      // Eşitlikte sönmek cezalandırma gibi okunur: kullanıcı en iyi gününü tekrar
      // yakalamıştır ve grafiğin ona "olmadı" demesi için bir sebep yoktur.
      expect(isBestDayOfWeek(week(40, 70, 30, 60, 45, 50, 70))).toBe(true);
    });

    it('arada veri olmayan günler varsa da — yeter ki üç gerçek gün olsun', () => {
      expect(isBestDayOfWeek(week(-1, -1, -1, -1, 30, 45, 60))).toBe(true);
    });
  });

  describe('parıldamadığı durumlar', () => {
    it('bugün en iyi değilse', () => {
      expect(isBestDayOfWeek(week(40, 55, 90, 60, 45, 50, 70))).toBe(false);
    });

    it('bugünü YALNIZCA bir gün geçiyorsa bile', () => {
      // "Neredeyse en iyi" diye bir şey yok; işaretin keskin olması onu güvenilir kılar.
      expect(isBestDayOfWeek(week(10, 10, 10, 10, 10, 71, 70))).toBe(false);
    });

    it('bugün sıfırsa — hiçbir şey yapılmamış gün kutlanmaz', () => {
      // Yeni kullanıcıda hafta boyu sıfır olabilir; teknik olarak "en iyi" ama
      // kutlanacak bir şey yok. Böyle bir parıltı işaretin anlamını ilk günden tüketirdi.
      expect(isBestDayOfWeek(week(0, 0, 0, 0, 0, 0, 0))).toBe(false);
    });

    it('bugünün verisi hiç yoksa', () => {
      expect(isBestDayOfWeek(week(40, 55, 30, 60, 45, 50, -1))).toBe(false);
    });

    it('üç günlük gerçek veri yoksa — "haftanın en iyisi" boş bir övgü olurdu', () => {
      // Grafiğin kendisi de bu durumda "grafik doluyor" diyor; aynı anda zafer
      // kutlamak iki farklı cümle kurmak olurdu.
      expect(isBestDayOfWeek(week(-1, -1, -1, -1, -1, 20, 60))).toBe(false);
    });

    it('tek günlük geçmişte karşılaştıracak bir şey yok', () => {
      expect(isBestDayOfWeek([90])).toBe(false);
      expect(isBestDayOfWeek([])).toBe(false);
    });
  });
});
