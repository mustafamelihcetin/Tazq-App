import { recoveryFromSleep } from '@/shared/utils/recovery';
import { adaptiveTaskCount } from '@/features/modes/utils/dailyPlanEngine';

/**
 * TOPARLANMA — sağlık verisinin planı beslediği yer.
 *
 * Plan motoru bugüne kadar yalnızca UYUMU biliyordu: "dün görevlerini yaptı mı?".
 * Bilmediği şey daha önemliydi: "bugün yapabilir mi?". Üst üste kötü uyumuş bir
 * kullanıcıya dünküyle aynı yükü vermek, planı gerçeğe değil takvime bağlar.
 *
 * ── SINIR ───────────────────────────────────────────────────────────────────────
 * Bu bir sağlık tavsiyesi DEĞİL. Kullanıcıya "az uyudun, dinlen" denmiyor; yalnız
 * uygulamanın KENDİ isteği hafifletiliyor. Aradaki fark hem etik hem hukuki: reçete
 * yazan, tutmadığında sorumluluğu da üstlenir.
 */

const day = (offset: number, now = new Date()) => {
  const d = new Date(now);
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('recoveryFromSleep', () => {
  const GOAL = 8;

  describe('hüküm verilemeyen durumlar → unknown', () => {
    it('hiç veri yoksa', () => {
      expect(recoveryFromSleep({}, GOAL)).toBe('unknown');
    });

    it('üç günden az veri varsa', () => {
      // Bir kötü gece hayatın normali, bir eğilim değil. İki gün de öyle.
      expect(recoveryFromSleep({ [day(0)]: 300, [day(1)]: 320 }, GOAL)).toBe('unknown');
    });

    it('hedef tanımsızsa', () => {
      expect(recoveryFromSleep({ [day(0)]: 300, [day(1)]: 300, [day(2)]: 300 }, 0)).toBe('unknown');
    });
  });

  describe('düşük toparlanma', () => {
    it('üç gün üst üste hedefin bir saatten fazla altı', () => {
      // 8 saat hedef, ~5.5 saat ortalama → borç birikmiş.
      const log = { [day(0)]: 330, [day(1)]: 320, [day(2)]: 340 };
      expect(recoveryFromSleep(log, GOAL)).toBe('low');
    });

    it('araya boş gün girse de son ÜÇ VERİLİ gün sayılır', () => {
      // Boş gün "sıfır uyku" sayılmaz: kullanıcı saatini şarj etmiş olabilir.
      // Veri yoksa bilgi yoktur — sıfır değil.
      const log = { [day(0)]: 320, [day(2)]: 330, [day(5)]: 310 };
      expect(recoveryFromSleep(log, GOAL)).toBe('low');
    });
  });

  describe('normal toparlanma', () => {
    it('hedefe yakın uyku', () => {
      const log = { [day(0)]: 460, [day(1)]: 480, [day(2)]: 470 };
      expect(recoveryFromSleep(log, GOAL)).toBe('normal');
    });

    it('küçük sapmalar borç saymaz — eşik GENİŞ', () => {
      // 20-30 dakikalık fark ölçüm gürültüsü (saat bilekten çıkar, telefon yatakta
      // kalır). Dar eşik planı her dalgada oynatır, kullanıcı sebebini anlayamaz.
      const log = { [day(0)]: 450, [day(1)]: 445, [day(2)]: 455 };
      expect(recoveryFromSleep(log, GOAL)).toBe('normal');
    });

    it('hedef KULLANICININ kendi hedefi — sabit 8 saat değil', () => {
      // 6 saatle dinlenen biri için 6 saat normaldir.
      const log = { [day(0)]: 360, [day(1)]: 355, [day(2)]: 365 };
      expect(recoveryFromSleep(log, 6)).toBe('normal');
      expect(recoveryFromSleep(log, 9)).toBe('low');
    });
  });
});

/**
 * YÜK YALNIZCA HAFİFLER — motorun mevcut sözleşmesi korunuyor.
 *
 * Az yük verip yanılmanın bedeli bir gün eksik çalışmak; fazla yük verip yanılmanın
 * bedeli kullanıcının planı tümden bırakması. İki hata aynı ağırlıkta değil.
 */
describe('adaptiveTaskCount — toparlanma etkisi', () => {
  const STRUGGLING = { activeDays7: 1, total14: 10 };
  const DOING_WELL = { activeDays7: 6, total14: 12 };

  it('toparlanma bilinmiyorsa hiçbir şey değişmez', () => {
    // Sağlık entegrasyonu kapalı olan kullanıcı için davranış AYNI kalmalı.
    expect(adaptiveTaskCount(3, DOING_WELL, 'unknown')).toBe(3);
    expect(adaptiveTaskCount(3, undefined, 'unknown')).toBe(3);
  });

  it('normal toparlanmada da değişmez', () => {
    expect(adaptiveTaskCount(3, DOING_WELL, 'normal')).toBe(3);
  });

  it('düşük toparlanma bir kademe hafifletir', () => {
    expect(adaptiveTaskCount(3, DOING_WELL, 'low')).toBe(2);
  });

  it('iyi uyku yükü ARTIRMAZ', () => {
    // Sözleşme: yalnızca hafifletir. 'normal' bir ödül değil, sadece kısıt yokluğu.
    expect(adaptiveTaskCount(2, DOING_WELL, 'normal')).toBe(2);
  });

  it('zorlanma ve dinlenmemişlik ÜST ÜSTE biner', () => {
    // İki ayrı sinyal, iki ayrı sebep: biri "yapmıyor", öteki "yapamaz".
    expect(adaptiveTaskCount(3, STRUGGLING, 'low')).toBe(1);
  });

  it('taban 1\'in altına inmez — plan görünmez olmamalı', () => {
    // Az bir şey her zaman hiçbir şeyden iyidir; sıfır görev, uygulamanın amacını
    // o gün için tümden ortadan kaldırırdı.
    expect(adaptiveTaskCount(1, STRUGGLING, 'low')).toBe(1);
    expect(adaptiveTaskCount(2, STRUGGLING, 'low')).toBe(1);
  });
});
