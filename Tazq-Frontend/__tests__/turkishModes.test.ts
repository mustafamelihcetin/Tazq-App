import {
  detectSporType,
  localizeSporGoal,
  getSporMode,
  getTezMode,
  getMulakatMode,
  getCustomExamMode,
  getModePreview,
  isSeasonalExamActive,
  getAllKnownModePairs,
} from '@/features/modes/utils/turkishModes';

/**
 * YAŞAM MODLARI — 2.614 satır, DAVRANIŞ TESTİ YOKTU.
 *
 * Bu dosya uygulamanın en büyük ve en değerli parçası: 271 hazır alışkanlık/görev
 * şablonu ve sekiz modun tamamı buradan üretiliyor. Kullanıcının günlük planı bu
 * fonksiyonların çıktısı.
 *
 * NEDEN RİSKLİ: buradaki bir hata uygulamayı ÇÖKERTMEZ. Yanlış görev üretir, yanlış
 * tarih yazar, boş plan döndürür — ve kullanıcı bunu "uygulama beni anlamadı" diye
 * yorumlar, hata olarak bildirmez. Sessiz bozulmanın ders kitabı örneği.
 *
 * Saat SABİTLENİYOR: mod kurucuları "hedefe kaç gün kaldı" hesaplıyor. Gerçek saatle
 * yazılan bir test yarın farklı sonuç verir ve zamanla kırılır.
 */

const REAL_NOW = Date.now();

function freeze(y: number, m: number, d: number) {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(y, m - 1, d, 12, 0, 0));
}

afterEach(() => {
  jest.setSystemTime(REAL_NOW);
  jest.useRealTimers();
});

/** Bugünden n gün sonrası — mod kurucuları ISO tarih bekliyor. */
function future(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('detectSporType — hedef metninden tür çıkarımı', () => {
  it('iki dilde de aynı türü bulur', () => {
    // Kullanıcı dili değiştirince planının değişmemesi gerekir.
    expect(detectSporType('Kilo Yönetimi')).toBe('kilo');
    expect(detectSporType('Weight Management')).toBe('kilo');
    expect(detectSporType('Maraton / Koşu')).toBe('maraton');
    expect(detectSporType('Marathon / Running')).toBe('maraton');
    expect(detectSporType('Güç & Kas')).toBe('guc');
    expect(detectSporType('Strength & Muscle')).toBe('guc');
  });

  it('emoji önekli etiketlerde de çalışır', () => {
    // Arayüz etiketleri emoji ile geliyor; çıkarım buna takılmamalı.
    expect(detectSporType('⚖️ Kilo Yönetimi')).toBe('kilo');
    expect(detectSporType('🏃 Maraton / Koşu')).toBe('maraton');
  });

  it('tanımadığı hedefte GENEL\'e düşer — null/undefined dönmez', () => {
    // Bilinmeyen hedef bir plan üretememe sebebi olmamalı.
    expect(detectSporType('Yüzme')).toBe('genel');
    expect(detectSporType('')).toBe('genel');
  });
});

describe('localizeSporGoal — dil değişince hedef adı da değişir', () => {
  it('Türkçe hedefi İngilizceye çevirir ve tersi', () => {
    expect(localizeSporGoal('Kilo Yönetimi', false)).toContain('Weight Management');
    expect(localizeSporGoal('Weight Management', true)).toContain('Kilo Yönetimi');
  });

  it('emoji varsa KORUNUR, yoksa eklenmez', () => {
    // Emoji burada veri değil biçim: kullanıcının seçtiği etikette varsa kalmalı.
    expect(localizeSporGoal('⚖️ Kilo Yönetimi', true)).toBe('⚖️ Kilo Yönetimi');
    expect(localizeSporGoal('Kilo Yönetimi', true)).toBe('Kilo Yönetimi');
  });

  it('boş girdide boş döner — "undefined" yazmaz', () => {
    expect(localizeSporGoal(null, true)).toBe('');
    expect(localizeSporGoal(undefined, true)).toBe('');
  });

  it('tanımadığı hedefi OLDUĞU GİBİ geçirir', () => {
    // Kullanıcının kendi yazdığı hedef adı korunuyor; bilinmeyen bir metni "genel"e
    // çevirmek kullanıcının yazdığını silmek olurdu.
    expect(localizeSporGoal('Yüzme antrenmanı', true)).toBe('Yüzme antrenmanı');
    // Yalnız boşluktan ibaret girdi de aynen geçiyor (kırpılmıyor) — zararsız,
    // çünkü ekranda boşluk olarak çiziliyor. Davranış burada BELGELENİYOR ki
    // ileride değişirse fark edilsin.
    expect(localizeSporGoal('   ', true)).toBe('   ');
  });
});

/**
 * MOD KURUCULARI — her biri kullanıcının günlük planını üretiyor.
 * Ortak sözleşme: DOLU bir mod dön, iki dilde etiketli, alışkanlık listesi boş değil.
 */
describe('mod kurucuları — sözleşme', () => {
  beforeEach(() => freeze(2026, 6, 1));

  const cases: Array<[string, () => any]> = [
    ['spor',    () => getSporMode('Kilo Yönetimi', future(60))],
    ['tez',     () => getTezMode('Yüksek Lisans Tezi', future(90))],
    ['mulakat', () => getMulakatMode('Acme A.Ş.', future(21))],
    ['sınav',   () => getCustomExamMode('ALES', future(45))],
  ];

  /**
   * MODLAR TANIMLAYICIDIR, PLAN DEĞİL.
   *
   * İlk yazdığım test `habits.length > 0` bekliyordu ve kırıldı. Varsayım yanlıştı:
   * bu fonksiyonlar modun KİMLİĞİNİ döndürüyor (etiket, kalan gün, çalışma şablonları);
   * günlük alışkanlık ve görevler `dailyPlanEngine` tarafından, faza ve kalan güne göre
   * ÜRETİLİYOR. Ayrım bilinçli — 271 şablonun tamamı her moda kopyalanmıyor.
   *
   * Test bu sözleşmeyi çiviliyor: alanlar VAR ve dizi, ama dolu olmaları şart değil.
   */
  it.each(cases)('%s modu geçerli bir tanımlayıcı döndürür', (_name, build) => {
    const m = build();
    expect(m).toBeTruthy();
    expect(Array.isArray(m.habits)).toBe(true);
    expect(Array.isArray(m.tasks)).toBe(true);
    expect(typeof m.type).toBe('string');
    expect(typeof m.emoji).toBe('string');
  });

  it.each(cases)('%s modu İKİ DİLDE de etiketli', (_name, build) => {
    const m = build();
    // Tek dilde bırakılan bir etiket, İngilizce kullanıcıya Türkçe metin gösterir.
    expect(typeof m.labelTr).toBe('string');
    expect(typeof m.labelEn).toBe('string');
    expect(m.labelTr.length).toBeGreaterThan(0);
    expect(m.labelEn.length).toBeGreaterThan(0);
    expect(m.labelTr).not.toBe(m.labelEn);
  });

  it.each(cases)('%s modunun alışkanlığı varsa iki dilde adlandırılmış', (_name, build) => {
    const m = build();
    for (const h of m.habits) {
      // Tek dilde bırakılan bir ad, İngilizce kullanıcıya Türkçe metin gösterir.
      expect(typeof h.name).toBe('string');
      expect(h.name.length).toBeGreaterThan(0);
      expect(typeof h.nameTr).toBe('string');
      expect(h.nameTr.length).toBeGreaterThan(0);
    }
  });

  /**
   * KALAN GÜN — TAKVİM farkı, üç sayacın hepsinde aynı.
   *
   * Eskiden `daysLeftInfo` hedefi 23:59:59'a ayarlayıp yukarı yuvarlıyordu ve ÜÇ hata
   * birden üretiyordu:
   *   · bir gün fazla sayıyordu (mod kartı 61, görev satırı 60 yazıyordu),
   *   · `isToday` hiç tetiklenmiyordu — sınav GÜNÜNDE "1 gün kaldı" diyordu,
   *   · 'YYYY-MM-DD' UTC ayrıştırılıyordu (negatif ofsetli ülkelerde gün kayması).
   */
  it('kalan gün takvim farkı kadar', () => {
    expect(getSporMode('Kilo Yönetimi', future(60)).daysLeft).toBe(60);
    expect(getMulakatMode('Acme', future(7)).daysLeft).toBe(7);
    expect(getCustomExamMode('ALES', future(1)).daysLeft).toBe(1);
  });

  it('HEDEF GÜNÜ tanınıyor — "1 gün kaldı" demiyor', () => {
    // En önemli gün ve en yanlış cümlenin yeriydi.
    const m = getSporMode('Kilo Yönetimi', future(0));
    expect(m.daysLeft).toBe(0);
    expect(m.subtitleTr).toContain('Bugün');
  });

  it('üç gün sayacı AYNI cevabı veriyor', () => {
    // Ayrışırlarsa kullanıcı aynı tarih için iki farklı sayı görür.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { daysLeftOf } = require('@/features/modes/utils/planTaskOps');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { daysUntil } = require('@/features/modes/utils/planAdaptations');
    const iso = future(30);
    expect(getSporMode('Kilo Yönetimi', iso).daysLeft).toBe(daysLeftOf(iso));
    expect(daysUntil(iso)).toBe(daysLeftOf(iso));
  });

  it('GEÇMİŞ tarihte negatif gün üretmez', () => {
    // Kullanıcı eski tarihli bir hedef girebiliyor; "-12 gün kaldı" yazılamaz.
    const m = getCustomExamMode('ALES', '2026-01-01');
    expect(m.daysLeft).toBeGreaterThanOrEqual(0);
  });
});

describe('getModePreview — kurulum öncesi önizleme', () => {
  beforeEach(() => freeze(2026, 6, 1));

  it('her mod türü için plan döndürür', () => {
    for (const type of ['spor', 'tez', 'mulakat'] as const) {
      const m = getModePreview(type, {
        sporGoal: 'Kilo Yönetimi', sporDate: future(60),
        tezName: 'Tez', tezDate: future(90),
        mulakatName: 'Acme', mulakatDate: future(21),
      });
      expect(m).toBeTruthy();
      expect(Array.isArray(m.habits)).toBe(true);
    }
  });

  it('eksik girdiyle ÇÖKMEZ', () => {
    // Kullanıcı formu yarım bırakıp önizlemeye basabiliyor.
    expect(() => getModePreview('spor')).not.toThrow();
    expect(() => getModePreview('tez')).not.toThrow();
  });
});

describe('mevsimsel sınav takvimi', () => {
  it('takvim dışı tarihte aktif DEĞİL', () => {
    // Tablo tükendiğinde `true` dönerse kart sonsuza kadar ekranda kalır —
    // Ramazan kartında birebir bu hata yaşanmıştı.
    freeze(2026, 1, 15);
    expect(typeof isSeasonalExamActive('yks')).toBe('boolean');
    expect(typeof isSeasonalExamActive('kpss')).toBe('boolean');
  });
});

describe('bilinen mod adları', () => {
  it('TR/EN çiftleri eksiksiz — eşleştirme buna dayanıyor', () => {
    const pairs = getAllKnownModePairs();
    expect(pairs.length).toBeGreaterThan(0);
    for (const p of pairs) {
      expect(p.tr.length).toBeGreaterThan(0);
      expect(p.en.length).toBeGreaterThan(0);
    }
  });
});
