import { classifyMovementTask, isMovementGoalMet, emptyActivity, type DayActivity } from '@/shared/utils/activityMatch';
import { getAllDailyPlanPairs } from '@/features/modes/utils/dailyPlanEngine';

/**
 * SAĞLIK VERİSİYLE OTOMATİK TAMAMLANAN HAREKET GÖREVLERİ.
 *
 * Buradaki testlerin ÇOĞUNLUĞU bir görevin otomatik tamamlanMAMASI gerektiğini
 * sabitliyor. Sebebi maliyetin asimetrik olması: yapılmamış bir işi "yapıldı" diye
 * işaretlemek kullanıcının otomatik işaretlere olan güvenini kalıcı olarak bitirir ve
 * momentum/seri gibi tüm türev sayıları kirletir. Kaçırılan bir eşleşme ise yalnızca
 * bir dokunuşa mal olur.
 */

const act = (p: Partial<DayActivity> = {}): DayActivity => ({ ...emptyActivity(), ...p });

describe('classifyMovementTask — hangi görev veriyle kanıtlanabilir', () => {
  describe('eşleşen görevler', () => {
    it('genel hareket görevi', () => {
      expect(classifyMovementTask('Bugün 30+ dk hareket et (tempolu yürüyüş veya antrenman)')).toBe('move');
      expect(classifyMovementTask('Move 30+ min today (brisk walk or workout)')).toBe('move');
      expect(classifyMovementTask('Bugün en az 30 dk aktif ol')).toBe('move');
      expect(classifyMovementTask('Be active for at least 30 min today')).toBe('move');
    });

    it('parantezinde "antrenman" geçse de genel hareket sayılır', () => {
      // Sıra hatası olsaydı bu görev `workout` olur ve yalnız ağırlık antrenmanıyla
      // kapanırdı — halbuki görevin kendisi "yürüyüş de olur" diyor.
      expect(classifyMovementTask('Bugün 30+ dk hareket et (tempolu yürüyüş veya antrenman)')).not.toBe('workout');
    });

    it('koşu görevi', () => {
      expect(classifyMovementTask('Bugünkü koşunu planına göre tamamla')).toBe('run');
      expect(classifyMovementTask("Complete today's run per your plan")).toBe('run');
    });

    it('antrenman görevi', () => {
      expect(classifyMovementTask('Bugünkü antrenman bölünmeni (split) tamamla')).toBe('workout');
      expect(classifyMovementTask("Complete today's training split")).toBe('workout');
    });
  });

  describe('eşleşmeyen görevler — veri bunları kanıtlayamaz', () => {
    it('kayıt/değerlendirme görevleri', () => {
      // "Koşu" kelimesi geçiyor ama istenen şey koşmak değil, yazmak.
      expect(classifyMovementTask('Bugünkü mesafeni ve nasıl hissettiğini kaydet')).toBeNull();
      expect(classifyMovementTask("Log today's distance and how you felt")).toBeNull();
      expect(classifyMovementTask('Koşunun detaylarını ve oruçlu antrenman hissiyatını kaydet')).toBeNull();
      expect(classifyMovementTask('Temel hareketlerde ağırlık/tekrarını kaydet')).toBeNull();
    });

    it('planlama görevleri — zamanlamayla ilgili, yapmakla değil', () => {
      expect(classifyMovementTask('Bugünkü koşunu iftar sonrasına veya sahur öncesine planla')).toBeNull();
      expect(classifyMovementTask("Schedule today's run after Iftar or before Sahur")).toBeNull();
    });

    it('hem planlama hem tamamlama içeren melez görev de elle kalır', () => {
      // Şüphe varsa eşleşme yok: "planla ve splitini tamamla" iki iş istiyor,
      // veri yalnız birini kanıtlayabiliyor.
      expect(classifyMovementTask('Ağır antrenmanını iftar sonrasına planla ve splitini tamamla')).toBeNull();
    });

    it('parantezdeki "mobilite/esneme" ana fiili (aktif ol) ezmez', () => {
      // Aynı kural "hareket et (…veya antrenman)" görevinde de geçerli: parantez
      // görevin ne olduğunu değil, nasıl yapılabileceğini söyler.
      expect(classifyMovementTask('İftar sonrası en az 30 dk hafif aktif ol (mobilite/esneme)')).toBe('move');
      expect(classifyMovementTask('İftar sonrası 30+ dk hafif tempolu yürüyüş veya hareket et')).toBe('move');
    });

    it('SINAV görevleri koşuyla tamamlanmaz — "koşul" ≠ "koşu"', () => {
      // Havuz taraması bu hatayı yakaladı: düz `koşu` deseni "gerçek sınav
      // KOŞULlarında" ifadesine takılıyor ve koşuya çıkan kullanıcının sınav çalışma
      // görevi kendiliğinden kapanıyordu.
      expect(classifyMovementTask('Ali: bugün tam deneme çöz — gerçek sınav koşullarında')).toBeNull();
      expect(classifyMovementTask('Ali: gerçek koşullarda tam deneme çöz — süreyi tut')).toBeNull();
    });

    it('esneme/mobilite — koşu kaydı esnemeyi kanıtlamaz', () => {
      expect(classifyMovementTask('Koşu öncesi/sonrası 10 dk esneme yap')).toBeNull();
      expect(classifyMovementTask('Do 10 min stretching before/after your run')).toBeNull();
      expect(classifyMovementTask('Bugün 10 dk esneme veya mobilite çalışması yap')).toBeNull();
    });

    it('beslenme/su görevleri — aynı fitness etiketini taşıyorlar', () => {
      // Etikete göre otomatik tamamlama yapılsaydı bunlar da kapanırdı.
      expect(classifyMovementTask('Bugün 2+ litre su iç ve şekerli içecekten kaçın')).toBeNull();
      expect(classifyMovementTask('Bugünkü öğünlerinde protein ve sebzeyi önceliklendir')).toBeNull();
      expect(classifyMovementTask('Bugün ne yediğini kısaca not et')).toBeNull();
    });

    it('boş metin', () => {
      expect(classifyMovementTask('')).toBeNull();
    });
  });

  /**
   * GERÇEK HAVUZ TARAMASI — bu testin asıl değeri burada.
   *
   * Yukarıdaki dizeler elle yazıldı; havuz değişirse eskirler. Bu test ise
   * dailyPlanEngine'in ÜRETTİĞİ tüm görev metinlerini gezip otomatik tamamlanabilir
   * olanları çıkarıyor ve bilinen listeyle karşılaştırıyor.
   *
   * Yani ileride havuza "akşam yürüyüşüne çık" gibi bir görev eklenirse test kırılır ve
   * ekleyen kişi bilinçli bir karar vermek zorunda kalır: bu gerçekten adım verisiyle
   * kapanmalı mı? Sessizce otomatik tamamlanmaya başlaması engellenmiş olur.
   */
  it('gerçek görev havuzlarında YALNIZCA beklenen görevler otomatik tamamlanabilir', () => {
    const pairs = getAllDailyPlanPairs();
    expect(pairs.length).toBeGreaterThan(20); // havuz gerçekten okundu mu

    const matched = pairs
      .map((p) => ({ tr: p.tr, kind: classifyMovementTask(`${p.tr} ${p.en}`) }))
      .filter((x) => x.kind !== null);

    expect(matched.map((m) => `${m.kind}: ${m.tr}`).sort()).toEqual([
      'move: Bugün 30+ dk hareket et (tempolu yürüyüş veya antrenman)',
      'move: Bugün en az 30 dk aktif ol',
      'run: Bugünkü koşunu planına göre tamamla',
      'workout: Bugünkü antrenman bölünmeni (split) tamamla',
    ]);
  });
});

describe('isMovementGoalMet — eşikler', () => {
  describe('koşu', () => {
    it('gerçek bir koşu tamamlar', () => {
      expect(isMovementGoalMet('run', act({ workouts: [{ kind: 'run', minutes: 32, distanceMeters: 5200 }] }))).toBe(true);
    });

    it('süre kısa ama mesafe yeterliyse tamamlar', () => {
      expect(isMovementGoalMet('run', act({ workouts: [{ kind: 'run', minutes: 8, distanceMeters: 1800 }] }))).toBe(true);
    });

    it('YÜRÜYÜŞ koşu görevini tamamlaMAZ', () => {
      // Maraton modunda bu ayrım antrenman planının kendisidir.
      expect(isMovementGoalMet('run', act({ workouts: [{ kind: 'walk', minutes: 90, distanceMeters: 7000 }] }))).toBe(false);
    });

    it('20 bin adım bile koşu görevini tamamlaMAZ', () => {
      expect(isMovementGoalMet('run', act({ steps: 20000, distanceMeters: 15000 }))).toBe(false);
    });

    it('çok kısa koşu sayılmaz', () => {
      expect(isMovementGoalMet('run', act({ workouts: [{ kind: 'run', minutes: 4, distanceMeters: 600 }] }))).toBe(false);
    });
  });

  describe('antrenman', () => {
    it('20+ dk seans tamamlar', () => {
      expect(isMovementGoalMet('workout', act({ workouts: [{ kind: 'other', minutes: 45, distanceMeters: 0 }] }))).toBe(true);
    });

    it('koşu da bir antrenmandır', () => {
      expect(isMovementGoalMet('workout', act({ workouts: [{ kind: 'run', minutes: 30, distanceMeters: 5000 }] }))).toBe(true);
    });

    it('yürüyüş antrenman sayılmaz', () => {
      expect(isMovementGoalMet('workout', act({ workouts: [{ kind: 'walk', minutes: 60, distanceMeters: 4000 }] }))).toBe(false);
    });

    it('kısa seans sayılmaz', () => {
      expect(isMovementGoalMet('workout', act({ workouts: [{ kind: 'other', minutes: 12, distanceMeters: 0 }] }))).toBe(false);
    });
  });

  describe('genel hareket', () => {
    it('egzersiz dakikası hedefi karşılar', () => {
      expect(isMovementGoalMet('move', act({ exerciseMinutes: 34 }))).toBe(true);
    });

    it('30+ dk yürüyüş de karşılar', () => {
      expect(isMovementGoalMet('move', act({ workouts: [{ kind: 'walk', minutes: 35, distanceMeters: 2500 }] }))).toBe(true);
    });

    it('yüksek adım sayısı karşılar', () => {
      expect(isMovementGoalMet('move', act({ steps: 8600 }))).toBe(true);
    });

    it('gün içi normal dolaşma karşılaMAZ', () => {
      // Eşik burada bilerek yüksek: 4-5 bin adım hiç egzersiz yapmadan da geçilir,
      // yani görevi yapmamış birine "yaptın" demek olurdu.
      expect(isMovementGoalMet('move', act({ steps: 5200, exerciseMinutes: 9 }))).toBe(false);
    });

    it('boş gün karşılamaz', () => {
      expect(isMovementGoalMet('move', emptyActivity())).toBe(false);
    });
  });
});
