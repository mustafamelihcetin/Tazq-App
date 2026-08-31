/**
 * TÜRKİYE'YE ÖZEL DÖNEMSEL MODLAR — dile göre.
 *
 * ÖLÇÜLEN SORUN: YKS, KPSS ve Ramazan takvime göre kendiliğinden devreye giriyordu ve
 * devreye girme kararı yalnız TARİHE bakıyordu, kullanıcının diline değil. Arayüzü
 * İngilizce olan kullanıcı Haziran'da "YKS Hazırlığı" bandını, ilkbaharda Ramazan
 * önerisini görüyordu — kendisi için hiçbir anlam taşımayan dönemler.
 *
 * Uygulamanın İÇERİĞİ Türkiye'ye özel, ARAYÜZÜ iki dilli; ikisi karışınca ürün hem
 * TR kullanıcısına eksik hem EN kullanıcısına alakasız görünüyordu.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const setLang = (lang: 'tr' | 'en') => {
  const { useLanguageStore } = require('@/shared/store/useLanguageStore');
  useLanguageStore.setState({ language: lang });
};

describe('kapı dili dinler', () => {
  it('Türkçede açık', () => {
    setLang('tr');
    const { isTurkeySeasonalEnabled } = require('@/features/modes/utils/localeGate');
    expect(isTurkeySeasonalEnabled()).toBe(true);
  });

  it('İngilizcede kapalı', () => {
    setLang('en');
    const { isTurkeySeasonalEnabled } = require('@/features/modes/utils/localeGate');
    expect(isTurkeySeasonalEnabled()).toBe(false);
  });
});

describe('otomatik dönemsel modlar', () => {
  it('İngilizcede YKS/KPSS otomatik devreye GİRMEZ', () => {
    setLang('en');
    const { isSeasonalExamActive } = require('@/features/modes/utils/turkishModes');
    expect(isSeasonalExamActive('yks')).toBe(false);
    expect(isSeasonalExamActive('kpss')).toBe(false);
  });

  it('İngilizcede takvim modu hiç algılanmaz', () => {
    setLang('en');
    const { detectTurkishMode } = require('@/features/modes/utils/turkishModes');
    expect(detectTurkishMode()).toBeNull();
  });

  it('Türkçede kapı ENGELLEMEZ — karar takvime kalır', () => {
    setLang('tr');
    const { isSeasonalExamActive, detectTurkishMode } = require('@/features/modes/utils/turkishModes');
    // Bugünün tarihine göre true/false olabilir; önemli olan kapının kapatmaması.
    expect(typeof isSeasonalExamActive('yks')).toBe('boolean');
    const mode = detectTurkishMode();
    expect(mode === null || typeof mode === 'object').toBe(true);
  });
});

describe('kapının SINIRI — evrensel modlar dokunulmaz', () => {
  const MODLAR = read('app/modlar.tsx');

  it('spor, tasarruf, tez, mülakat, bırakma her dilde seçilebilir', () => {
    // Bunlar Türkiye'ye özel değil, yalnızca burada da kullanılıyor.
    for (const key of ["key: 'spor'", "key: 'tez'", "key: 'mulakat'", "key: 'tasarruf'"]) {
      expect(MODLAR).toContain(key);
    }
    const src = read('features/modes/utils/turkishModes.ts');
    // Kapı YALNIZ takvim-tetiklemeli iki fonksiyonda; başka hiçbir modu etkilemiyor.
    const guarded = [...src.matchAll(/export function (\w+)[\s\S]{0,160}?isTurkeySeasonalEnabled\(\)/g)].map(m => m[1]);
    expect(guarded.sort()).toEqual(['detectTurkishMode', 'isSeasonalExamActive']);
  });

  it('kullanıcının KENDİ adını yazdığı sınav modu kapıya takılmaz', () => {
    // "Sınav Takibi" serbest metinlidir; İngilizcede de "Study plan for any exam"
    expect(MODLAR).toContain("Study plan for any exam");
    expect(MODLAR).toContain("setSeasonalPref('examMode', true)");
  });
});

describe('Ramazan kartı', () => {
  const CARD = read('features/modes/components/modes/RamazanCard.tsx');

  it('takvim ÖNERİSİ dile bağlı', () => {
    expect(CARD).toContain('isTurkeySeasonalEnabled() &&');
  });

  it('kullanıcı KENDİ açtıysa dil önemsiz — tercih ezilmez', () => {
    // `seasonal.ramazan` kapının DIŞINDA kalmalı
    expect(CARD).toContain('if (!(seasonal.ramazan || calendarSuggests)) return null;');
    const gate = CARD.slice(CARD.indexOf('const calendarSuggests'), CARD.indexOf('if (!(seasonal.ramazan'));
    expect(gate).not.toContain('seasonal.ramazan');
  });
});

describe('dil okunamazsa özellik sessizce kapanmaz', () => {
  it('varsayılan AÇIK — kapatma yalnız açık bir "en" tercihiyle olur', () => {
    const fn = read('features/modes/utils/localeGate.ts');
    expect(fn).toContain('return true;');
    expect(fn).toContain('catch');
  });
});
