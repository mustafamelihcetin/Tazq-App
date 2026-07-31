import { weeklyTrainingAdherence } from '@/features/modes/utils/planAdaptations';

/**
 * HAFTALIK ANTRENMAN UYUMU — maraton planının kendini ayarlamak için baktığı sayı.
 *
 * ── BU TESTİN VAR OLMA SEBEBİ ───────────────────────────────────────────────────
 * Buraya sabit `0.7` yazılıydı. `buildMaratonAdaptationTasks`in karar eşikleri `< 0.5`
 * ve `>= 0.8` olduğu için 0.7 tam ölü bandın ortasına düşüyordu: iki dal da HİÇ
 * çalışmadı. Yani "planınız performansınıza göre uyum sağlar" diye sunulan sistem,
 * kullanıcı o hafta hiç koşmasa da her şeyi eksiksiz yapsa da aynı planı veriyordu.
 *
 * Sessiz ölü kod, çöken koddan daha tehlikeli: kimse şikâyet etmez çünkü bir şey
 * bozulmuş gibi görünmez. Bu testler o sessizliği kalıcı olarak bozuyor.
 */

const day = (offset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString();
};

const done = (id: number, offset: number) => ({ id, isCompleted: true, completedAt: day(offset) });

describe('weeklyTrainingAdherence', () => {
  const ids = [1, 2, 3, 4, 5, 6];

  describe('hüküm verilemeyen durumlar → null', () => {
    it('plan bir haftasını doldurmadıysa', () => {
      // İkinci günde "haftayı tekrarla" demek hem yanlış hem moral bozucu olurdu:
      // oran düşüktür çünkü hafta bitmemiştir, kullanıcı başarısız olduğu için değil.
      expect(weeklyTrainingAdherence([done(1, 0)], ids, 3, 0)).toBeNull();
    });

    it('haftalık hedef tanımsızsa', () => {
      expect(weeklyTrainingAdherence([done(1, 0)], ids, 0, 4)).toBeNull();
    });
  });

  describe('gerçek oran', () => {
    it('hedef tutulduğunda 1', () => {
      const tasks = [done(1, 0), done(2, -2), done(3, -4)];
      expect(weeklyTrainingAdherence(tasks, ids, 3, 4)).toBe(1);
    });

    it('hiç antrenman yoksa 0 — "haftayı tekrarla" dalını açar', () => {
      expect(weeklyTrainingAdherence([], ids, 3, 4)).toBe(0);
    });

    it('kısmi tamamlamada oran', () => {
      expect(weeklyTrainingAdherence([done(1, 0)], ids, 3, 4)).toBeCloseTo(1 / 3);
    });

    it('hedefi aşmak 1\'i geçmez', () => {
      const tasks = [done(1, 0), done(2, -1), done(3, -2), done(4, -3), done(5, -4)];
      expect(weeklyTrainingAdherence(tasks, ids, 3, 4)).toBe(1);
    });
  });

  describe('GÜN sayılır, görev değil', () => {
    it('aynı gün üç görev tek gün sayılır', () => {
      // Antrenman planlarında hacmin güne yayılması önemli: tek günde üç kutu
      // işaretlemek, üç ayrı gün antrenman yapmakla aynı şey değildir.
      const tasks = [done(1, 0), done(2, 0), done(3, 0)];
      expect(weeklyTrainingAdherence(tasks, ids, 3, 4)).toBeCloseTo(1 / 3);
    });
  });

  describe('kapsam ve veri temizliği', () => {
    it('plana ait OLMAYAN görev sayılmaz', () => {
      const tasks = [{ id: 99, isCompleted: true, completedAt: day(0) }];
      expect(weeklyTrainingAdherence(tasks, ids, 3, 4)).toBe(0);
    });

    it('tamamlanmamış görev sayılmaz', () => {
      expect(weeklyTrainingAdherence([{ id: 1, isCompleted: false, completedAt: day(0) }], ids, 3, 4)).toBe(0);
    });

    it('7 günden ESKİ tamamlama sayılmaz', () => {
      // Pencere "bu hafta" demek; geçen ayın koşusu bu haftanın kararını etkilememeli.
      expect(weeklyTrainingAdherence([done(1, -9)], ids, 3, 4)).toBe(0);
    });

    it('sunucunun "tarih yok" değeri (0001-01-01) sayılmaz', () => {
      // Bu değer gerçek bir tamamlama değil; sayılsaydı hiç yapılmamış antrenmanlar
      // uyum oranını şişirir ve plan haksız yere hacim artırırdı.
      const tasks = [{ id: 1, isCompleted: true, completedAt: '0001-01-01T00:00:00Z' }];
      expect(weeklyTrainingAdherence(tasks, ids, 3, 4)).toBe(0);
    });

    it('tarihi bozuk kayıt çökmeden atlanır', () => {
      const tasks = [{ id: 1, isCompleted: true, completedAt: 'bozuk-tarih' }, done(2, 0)];
      expect(weeklyTrainingAdherence(tasks, ids, 3, 4)).toBeCloseTo(1 / 3);
    });

    it('completedAt yoksa sayılmaz', () => {
      expect(weeklyTrainingAdherence([{ id: 1, isCompleted: true }], ids, 3, 4)).toBe(0);
    });
  });

  /**
   * ESKİ HATANIN KENDİSİ: 0.7 iki eşiğin de arasındaydı.
   *
   * Bu test, ölü bandın geri gelmediğini doğruluyor — üretilen değerler artık gerçekten
   * eşiklerin İKİ TARAFINA da düşebiliyor.
   */
  it('üretilen oranlar karar eşiklerinin iki tarafına da düşebiliyor', () => {
    const noTraining = weeklyTrainingAdherence([], ids, 3, 4)!;
    const fullTraining = weeklyTrainingAdherence([done(1, 0), done(2, -2), done(3, -4)], ids, 3, 4)!;

    expect(noTraining).toBeLessThan(0.5);      // "haftayı tekrarla" erişilebilir
    expect(fullTraining).toBeGreaterThanOrEqual(0.8); // "hacmi artır" erişilebilir
  });
});
