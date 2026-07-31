import { stepSummary, formatSteps, formatDistance } from '@/shared/utils/stepInsight';

/**
 * ADIM ÖZETİ — spor modundaki günlük hareket satırı.
 *
 * Bu testlerin bir kısmı sayı biçimini, bir kısmı ise TONU koruyor. Ton da en az
 * hesap kadar kırılgan: "Hafif bir gün" ile "az hareket ettin" arasındaki fark,
 * kullanıcının uygulamayı açmaya devam edip etmemesini belirleyebilir.
 */

describe('formatSteps — binlik ayraç elle yapılıyor', () => {
  it('Türkçe nokta ile ayırır', () => {
    expect(formatSteps(6240, 'tr')).toBe('6.240 adım');
    expect(formatSteps(12045, 'tr')).toBe('12.045 adım');
  });

  it('İngilizce virgül ile ayırır', () => {
    expect(formatSteps(6240, 'en')).toBe('6,240 steps');
  });

  it('dört basamaktan küçükler ayraçsız', () => {
    expect(formatSteps(940, 'tr')).toBe('940 adım');
  });

  it('bozuk değerlerde çökmez', () => {
    // Platformdan NaN/negatif gelebilir; ekrana "NaN adım" yazmasın.
    expect(formatSteps(NaN, 'tr')).toBe('0 adım');
    expect(formatSteps(-50, 'tr')).toBe('0 adım');
  });
});

describe('formatDistance', () => {
  it('km olarak tek ondalık, Türkçede virgüllü', () => {
    expect(formatDistance(4523, 'tr')).toBe('4,5 km');
    expect(formatDistance(4523, 'en')).toBe('4.5 km');
  });

  it('100 m altı GÖSTERİLMEZ', () => {
    // "0,0 km" hiçbir şey söylemez; satırı kalabalıklaştırmaktan başka işi yok.
    expect(formatDistance(60, 'tr')).toBeNull();
    expect(formatDistance(0, 'tr')).toBeNull();
  });

  it('bozuk değerde null', () => {
    expect(formatDistance(NaN, 'tr')).toBeNull();
  });
});

describe('stepSummary — bantlar ve ton', () => {
  it('veri yokken bant "none"', () => {
    const s = stepSummary(0, 0, 'tr');
    expect(s.band).toBe('none');
    expect(s.distance).toBeNull();
  });

  it('bantlar eşiklere göre ilerler', () => {
    expect(stepSummary(1200, 0, 'tr').band).toBe('light');
    expect(stepSummary(4500, 0, 'tr').band).toBe('moving');
    expect(stepSummary(8200, 0, 'tr').band).toBe('good');
    expect(stepSummary(11000, 0, 'tr').band).toBe('great');
  });

  it('eşik sınırları doğru tarafta', () => {
    expect(stepSummary(2999, 0, 'tr').band).toBe('light');
    expect(stepSummary(3000, 0, 'tr').band).toBe('moving');
    expect(stepSummary(6999, 0, 'tr').band).toBe('moving');
    expect(stepSummary(7000, 0, 'tr').band).toBe('good');
    expect(stepSummary(9999, 0, 'tr').band).toBe('good');
    expect(stepSummary(10000, 0, 'tr').band).toBe('great');
  });

  it('mesafe GERÇEK veriden gelir, adımdan türetilmez', () => {
    // Adım çok, mesafe az olabilir (koşu bandı, dar alan). Uydurmak yerine olduğu gibi.
    const s = stepSummary(9000, 300, 'tr');
    expect(s.distance).toBe('0,3 km');
  });

  describe('TON — düşük bantta suçlama yok', () => {
    it('hiçbir bant kullanıcıyı yargılayan bir kelime içermiyor', () => {
      // Uygulama, hareketsiz bir günün sebebini bilmez (hastalık, iş, yas olabilir).
      // Bilmediği şey hakkında hüküm veren bir arayüz kapatılmayı hak eder.
      const forbidden = /az |yetersiz|düşük|kötü|başarısız|low|poor|not enough|failed/i;
      for (const steps of [0, 500, 2000, 5000, 8000, 15000]) {
        expect(stepSummary(steps, 0, 'tr').note).not.toMatch(forbidden);
        expect(stepSummary(steps, 0, 'en').note).not.toMatch(forbidden);
      }
    });

    it('ANTRENÖRLÜK yok — reçete, kalori, hedef dayatması içermiyor', () => {
      // Bu bir alışkanlık uygulaması, spor koçu değil. Reçete yazdığımız an
      // tutmadığında sorumluluğu da almış oluruz; ayrıca sağlık iddiası,
      // uygulama mağazalarında ayrı bir inceleme kategorisi.
      const coaching = /kalori|calorie|hedef|goal|malısın|meli\b|should|must|try to|tempo|nabız/i;
      for (const steps of [0, 2000, 8000, 15000]) {
        expect(stepSummary(steps, 4000, 'tr').note).not.toMatch(coaching);
        expect(stepSummary(steps, 4000, 'en').note).not.toMatch(coaching);
      }
    });

    it('her bantta iki dilde de bir not var', () => {
      for (const steps of [0, 2000, 5000, 8000, 12000]) {
        expect(stepSummary(steps, 0, 'tr').note.length).toBeGreaterThan(3);
        expect(stepSummary(steps, 0, 'en').note.length).toBeGreaterThan(3);
      }
    });
  });
});
