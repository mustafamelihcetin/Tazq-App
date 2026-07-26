import fs from 'fs';
import path from 'path';

/**
 * ARAYÜZ TUTARLILIĞI BEKÇİSİ.
 *
 * Bu dosyadaki her kural, gerçekten yaşanmış bir tutarsızlığı çiviler. Kural
 * yazmak yetmiyordu; ölçülmeyen kural zamanla ayrışıyor (bkz. mod renklerinin
 * palet düzeltildikten sonra bile ekranlarda ham hex olarak yaşamaya devam etmesi).
 */

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

describe('geri düğmesi deseni', () => {
  /**
   * Uygulamada BİLİNÇLİ olarak iki desen var:
   *   1. Başlığı olan ekranlar → ScreenHeader'ın `onBack`'i (ArrowLeft, tek yerde)
   *   2. Başlıksız/tam ekranlar → BackButton bileşeni (cam daire, ChevronLeft)
   *
   * Önce ikisi KARIŞMIŞTI (settings, 1. desenin konumunda 2. desenin ikonunu
   * kullanıyordu). Sonra 1. desendeki her ekran geri okunu KENDİ çiziyordu — aynı
   * eylem beş dosyada beş kez. Artık tek kaynak: ScreenHeader.
   */
  const HEADER_SCREENS = [
    'app/settings.tsx', 'app/report.tsx', 'app/archive.tsx',
    'app/mod-ozet.tsx', 'app/legal.tsx',
  ];

  it('başlıklı ekranlar geri okunu KENDİ çizmez — ScreenHeader onBack kullanır', () => {
    const own = HEADER_SCREENS.filter(f => /<(ArrowLeft|ChevronLeft)/.test(stripComments(read(f))));
    expect(own).toEqual([]);
    const missing = HEADER_SCREENS.filter(f => !/onBack=\{/.test(read(f)));
    expect(missing).toEqual([]);
  });

  it('yüzen cam geri butonu yalnız BAŞLIKSIZ ekranlarda', () => {
    // profile/achievements/register/verify-email: tam ekran, başlık satırı yok.
    const glass = ['app/profile.tsx', 'app/achievements.tsx', 'app/register.tsx', 'app/verify-email.tsx'];
    const missing = glass.filter(f => !/<BackButton/.test(read(f)));
    expect(missing).toEqual([]);
    // Başlıklı ekranlar bu deseni KULLANMAMALI (iki desen karışmasın).
    const mixed = HEADER_SCREENS.filter(f => /<BackButton/.test(read(f)));
    expect(mixed).toEqual([]);
  });

  it('ölü bileşen geri gelmemeli — CollapsingHeaderScreen silindi', () => {
    // Hiçbir yerde kullanılmıyordu ve kendi içinde borç taşıyordu (F ölçeği dışı
    // 30pt başlık, 44pt altı 40pt dokunma hedefi). Kullanılmayan bileşen bakım yükü.
    expect(fs.existsSync(path.join(ROOT, 'shared/components/CollapsingHeaderScreen.tsx'))).toBe(false);
  });

  it('ekran başlığı puntosu TEK yerde — sayfalar kendi ölçüsünü yazmaz', () => {
    /**
     * Ölçülen dağılım (düzeltmeden önce):
     *   ana 4 ekran 17pt · mod-ozet 17.3 · report 20.4 · settings 22.4 ·
     *   archive 22.4 · legal 14 · mod-ozet büyük başlık 30 (ölçek dışı)
     * Yön de tersti: alt sayfaya inince başlık BÜYÜYORDU.
     */
    const OWN_TITLE = /fontSize: F\.(title|title3|subhead|body)/;
    const offenders: string[] = [];
    for (const f of [...HEADER_SCREENS, 'app/index.tsx', 'app/tasks.tsx', 'app/cockpit.tsx', 'app/modlar.tsx']) {
      const src = stripComments(read(f));
      const i = src.indexOf('<ScreenHeader');
      if (i < 0) continue;
      const end = src.indexOf('/>', i);
      if (OWN_TITLE.test(src.slice(i, end < 0 ? undefined : end))) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });
});

describe('alt navigasyon', () => {
  const src = read('shared/components/BottomNavBar.tsx');

  it('sekme adı ekran okuyucuya verilir', () => {
    // Bar ikon-only. Etiket/gösterge tasarımı kullanıcıyla netleşene kadar
    // görsel bir şart koşulmuyor; erişilebilirlik tarafı ise pazarlık dışı.
    expect(src).toMatch(/accessibilityLabel=\{tr \? TAB_LABELS/);
  });

  it('her sekmenin erişilebilirlik etiketi ve seçili durumu var', () => {
    expect(src).toContain('accessibilityRole="tab"');
    expect(src).toContain('accessibilityState={{ selected: isActive }}');
  });
});

describe('erişilebilirlik — giriş akışı', () => {
  /**
   * Ölçüm: login 1/40, register 1/31, onboarding 0/8, verify-email 0/11 idi.
   * Uygulamaya GİRİŞİN kendisi ekran okuyucuyla kullanılamıyordu; ilk temas sessizdi.
   * Bu ekranlar için asgari etiket sayısı çivileniyor — düşerse test kırılır.
   */
  const MIN_LABELS: Record<string, number> = {
    'app/login.tsx': 10,
    'app/register.tsx': 6,
    'app/verify-email.tsx': 3,
    'app/onboarding.tsx': 2,
  };

  for (const [file, min] of Object.entries(MIN_LABELS)) {
    it(`${file} en az ${min} accessibilityLabel taşır`, () => {
      const count = (read(file).match(/accessibilityLabel/g) ?? []).length;
      expect(count).toBeGreaterThanOrEqual(min);
    });
  }
});

describe('dönemsel modlar — akış dili', () => {
  const FILES = [
    'app/modlar.tsx',
    'features/modes/components/modes/SporCard.tsx',
    'features/modes/components/modes/ExamCard.tsx',
    'features/modes/components/modes/TezCard.tsx',
    'features/modes/components/modes/MulakatCard.tsx',
    'features/modes/components/TurkishModeBanner.tsx',
  ];
  // Yorumlar hariç: gerekçe metinlerinde eski etiketten söz etmek serbest olmalı.
  const all = FILES.map(f => stripComments(read(f))).join('\n');

  it('tek fiil dili: Kur → Planı Seç → Başlat', () => {
    // Aynı niyet için DÖRT ayrı fiil vardı: "+ Ekle" → "Hedef ekle" →
    // "Plan Oluştur" / "Planı Önizle & Uygula" → "Uygula". Kullanıcı her adımda
    // "bu az önce bastığımın aynısı mı?" diye duraksıyordu.
    const stale = ['+ Ekle', 'Plan Oluştur ›', 'Planı Önizle & Uygula', 'Preview & Apply Plan', 'Create Plan ›'];
    const found = stale.filter(v => all.includes(v));
    expect(found).toEqual([]);
  });

  it('kurulum çağrısı "Kur", plan seçimi "Planı Seç", onay "Planı Başlat"', () => {
    expect(read('app/modlar.tsx')).toContain("'Kur' : 'Set up'");
    expect(all).toContain("'Planı Seç ›' : 'Choose Plan ›'");
    expect(read('features/modes/components/TurkishModeBanner.tsx')).toContain('Planı Başlat');
  });
});

describe('dönemsel modlar — tekilleştirilmiş takvim', () => {
  it('modlar.tsx sınav tarih tablosunun kopyasını taşımaz', () => {
    // Ramazan'da düzeltilen hatanın aynısıydı: YKS/KPSS tarihleri hem
    // turkishModes.ts'te hem modlar.tsx içinde elle yazılıydı. İkinci kopya,
    // birincisi güncellendiğinde sessizce eskiyor.
    const src = stripComments(read('app/modlar.tsx'));
    expect(src).not.toMatch(/YKS_DATES|KPSS_DATES/);
    expect(src).toContain('isSeasonalExamActive');
  });

  it('Ramazan kartı, tarih tablosu tükendiğinde görünmez', () => {
    // `daysUntilStart <= 7` tek başına yeterli değildi: tablo bitince status
    // {period: null, daysUntilStart: 0} döner ve 0 <= 7 doğru olduğu için kart
    // sonsuza kadar boş halde ekranda kalıyordu.
    expect(read('features/modes/components/modes/RamazanCard.tsx')).toContain('!!ramadanStatus.period');
  });
});

describe('iki dillilik (TR/EN)', () => {
  /**
   * Uygulama baştan iki dilli. Yeni bir etiket eklerken TEK dilde bırakmak, İngilizce
   * kullanıcıya Türkçe metin göstermek demektir ve derleme bunu yakalamaz.
   *
   * Kural: kullanıcıya GÖRÜNEN Türkçe metin (accessibilityLabel/Hint dahil) her zaman
   * `tr ? '…' : '…'` ya da `language === 'tr' ? '…' : '…'` seçicisiyle yazılır.
   * Bu test, seçici olmadan yazılmış Türkçe-karakterli etiketleri arar.
   */
  const TURKISH = /[ğüşıöçĞÜŞİÖÇ]/;
  const SCREENS = [
    'app/modlar.tsx', 'app/mod-ozet.tsx', 'app/login.tsx', 'app/register.tsx',
    'app/verify-email.tsx', 'app/onboarding.tsx', 'app/settings.tsx', 'app/tasks.tsx',
    'features/modes/components/modes/SporCard.tsx',
    'features/modes/components/modes/ExamCard.tsx',
    'features/modes/components/modes/TezCard.tsx',
    'features/modes/components/modes/MulakatCard.tsx',
    'features/modes/components/modes/RamazanCard.tsx',
    'features/modes/components/TurkishModeBanner.tsx',
    'shared/components/BottomNavBar.tsx',
    'shared/components/WeightEntryModal.tsx',
    'shared/components/TasarrufCard.tsx',
    'shared/components/BirakmaCard.tsx',
  ];

  it('erişilebilirlik etiketleri iki dilli yazılır', () => {
    const hits: string[] = [];
    for (const rel of SCREENS) {
      stripComments(read(rel)).split('\n').forEach((line, i) => {
        const m = line.match(/accessibility(?:Label|Hint)=\{?([^\n]*)/);
        if (!m) return;
        const val = m[1];
        if (!TURKISH.test(val)) return;                 // Türkçe metin yoksa konu dışı
        if (/\?[^:]*:/.test(val)) return;               // dil seçicisi var
        if (/\bt\.[a-zA-Z]/.test(val)) return;           // i18n sözlüğünden geliyor
        if (/^\s*\{?\s*(tr|en)\b/.test(val)) return;     // değişkenden geliyor
        hits.push(`${rel}:${i + 1}`);
      });
    }
    expect(hits).toEqual([]);
  });

  it('bu turda eklenen etiketlerin TR ve EN karşılığı birlikte var', () => {
    const all = SCREENS.map(read).join('\n');
    const PAIRS: Array<[string, string]> = [
      ['Kur', 'Set up'],
      ['Planı Seç ›', 'Choose Plan ›'],
      ['Planı Başlat', 'Start Plan'],
      ['Aktif Hedeflerim', 'Active Goals'],
      ['Kurulumu Tamamla', 'Finish Setup'],
      ['Yaklaşan Dönem', 'Upcoming Season'],
      ['Tartım zaten kayıtlı', 'Weigh-in already logged'],
      ['Modları tanıt', 'Show modes walkthrough'],
    ];
    const broken = PAIRS.filter(([tr, en]) => all.includes(tr) !== all.includes(en));
    expect(broken).toEqual([]);
  });

  it('sekme etiketleri her iki dilde tanımlı', () => {
    const src = read('shared/components/BottomNavBar.tsx');
    const ids = ['home', 'tasks', 'focus', 'cockpit', 'modlar'];
    const missing = ids.filter(id => !new RegExp(`${id}: \{ tr: '[^']+', en: '[^']+' \}`).test(src));
    expect(missing).toEqual([]);
  });
});
