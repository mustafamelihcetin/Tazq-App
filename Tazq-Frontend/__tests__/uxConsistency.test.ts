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
    'features/modes/components/WeightEntryModal.tsx',
    'features/modes/components/modes/TasarrufCard.tsx',
    'features/modes/components/modes/BirakmaCard.tsx',
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

describe('ikon dili — ham emoji değil, flat glif', () => {
  /**
   * Uygulama flat ikon dili kullanır (AppIcon / lucide + `renderModeEmojiIcon`
   * eşlemesi). Ham emoji üç sebeple yasak:
   *   · platforma göre farklı çizilir (iOS/Android/Windows ayrı sanatçı),
   *   · tema-duyarsızdır — koyu temada olduğu gibi kalır,
   *   · palet ve kontrast disiplininin tamamen dışındadır.
   *
   * Bu tur ihlal edildi: mod kapatma toast'larına emoji önekleri eklendi
   * (📚 Tez, 💼 Mülakat, 💪 Spor, 🌙 Ramazan). Toast zaten tipine göre kendi
   * ikonunu çiziyor; emoji hem gereksiz hem dil dışıydı.
   */
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;
  const NOTIFY_FILES = [
    'app/modlar.tsx',
    'features/modes/components/modes/ExamCard.tsx',
    'features/modes/components/modes/TezCard.tsx',
    'features/modes/components/modes/MulakatCard.tsx',
    'features/modes/components/modes/SporCard.tsx',
    'features/modes/components/modes/RamazanCard.tsx',
  ];

  it('bildirim/toast metinleri emoji öneki taşımaz', () => {
    const hits: string[] = [];
    for (const f of NOTIFY_FILES) {
      stripComments(read(f)).split('\n').forEach((line, i) => {
        const m = line.match(/'([^']*(?:modu kapatıldı|mode closed)[^']*)'/);
        if (m && EMOJI.test(m[1])) hits.push(`${f}:${i + 1}`);
      });
    }
    expect(hits).toEqual([]);
  });
});

describe('başlık çubuğu öğe ölçüleri', () => {
  /**
   * Avatar bir süre glif ikondan BÜYÜKTÜ (34 vs 30) ve o doğruydu: çubukta ÜÇ öğe
   * vardı (avatar · TAZQ kelime işareti · durum rozeti) ve bir fotoğraf, aynı
   * kutudaki tek renkli bir gliften optik olarak küçük okunur.
   *
   * Kelime işareti kalkınca gerekçe de düştü. Artık iki öğe var ve ikisi karşılıklı
   * KENARDA; aralarında hiçbir şey yokken göz onları doğrudan karşılaştırır ve farklı
   * çap "denge" değil "hata" gibi okunur. Optik telafi kaldırılmadı, yer değiştirdi:
   * artık avatarın çevresindeki halka inceltilerek yapılıyor.
   */
  const tokens = read('shared/constants/tokens.ts');
  const item = Number(tokens.match(/TOP_ITEM_SIZE = (\d+)/)?.[1]);

  it('iki kenar öğesi AYNI ölçüde — takma ad, bir daha ayrışamaz', () => {
    expect(tokens).toMatch(/TOP_AVATAR_SIZE = TOP_ITEM_SIZE/);
  });

  it('kenar öğeleri 44pt çubuğa nefes payıyla sığar', () => {
    const bar = Number(tokens.match(/TOP_BAR_HEIGHT = (\d+)/)?.[1]);
    expect(bar - item).toBeGreaterThanOrEqual(8); // üst+alt toplam >= 8pt
  });

  it('dashboard avatarı avatar ölçüsünü kullanır', () => {
    const src = read('app/index.tsx');
    expect(src).toMatch(/avatarContainer: \{ width: TOP_AVATAR_SIZE, height: TOP_AVATAR_SIZE/);
  });

  /**
   * Halka, kişiselleştirme rengi seçilince 2.5pt DOLU bir çember oluyordu. Solda dolu
   * bir fotoğraf + kalın renkli halka, sağda saydam zeminli ince bir glif vardı: çubuk
   * gözle görülür biçimde sola ağırlık yapıyordu — üstelik yalnız renk seçen
   * kullanıcılarda, yani tasarımı test edenin göremeyeceği bir durumda.
   */
  it('avatar halkası HER durumda hairline — kalınlık kişiselleştirmeye bağlı değil', () => {
    const src = read('app/index.tsx');
    const block = src.match(/hitSlop=\{touchSlop\(TOP_AVATAR_SIZE\)\}[\s\S]*?borderWidth: [^,\n]+/)?.[0] ?? '';
    // Renk seçilince kalınlaşıyordu (2.5 → 1.5): dolu fotoğraf + kalın renkli halka,
    // karşısındaki saydam zeminli glife göre gözle görülür biçimde ağır basıyordu.
    // Üstelik yalnız renk SEÇEN kullanıcılarda — tasarımı test edenin göremeyeceği durum.
    expect(block).toMatch(/borderWidth: B\.thin\s*$/);
  });

  /**
   * Varsayılan halka `rgba(255,255,255,0.1)` yazılıydı: AÇIK TEMADA beyaz üstünde
   * beyaz, yani hiç görünmüyordu. Koyu temada bakılıp doğru sanılmış bir renk.
   */
  it('varsayılan halka rengi tema jetonundan gelir — açık temada da görünür', () => {
    const src = read('app/index.tsx');
    const line = src.match(/borderColor: \(!avatarBorderColor.*/)?.[0] ?? '';
    expect(line).toContain('theme.outlineVariant');
    // Kod içinde (yorumlar hariç) o renk hiç kalmamalı: aynı hata başka kutulara
    // kopyalanmıştı — kullanılmayan `quickDraftSheet` stili de aynısını taşıyordu.
    const code = src
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
    expect(code).not.toContain('rgba(255,255,255,0.1)');
  });
});

/**
 * ANA SAYFADA İKİ BAŞLIK SİSTEMİ SORUNU.
 *
 * Başlık çubuğunun ortasında hiç değişmeyen bir TAZQ kelime işareti, hemen altında
 * ise 28pt'lik selamlama vardı. Kullanıcı aşağı kaydırınca selamlama gidiyor, yerine
 * hiçbir şey gelmiyordu: geriye nerede olduğunu söylemeyen bir çubuk kalıyordu.
 * iOS'ta bunlar TEK sistemdir — büyük başlık kaydıkça kompakt başlığa dönüşür.
 */
describe('ana sayfa başlığı — tek sistem', () => {
  const src = read('app/index.tsx');
  const header = read('shared/components/ScreenHeader.tsx');

  /**
   * Kelime işareti bir ara tamamen KALDIRILMIŞTI. Teşhis doğruydu (çubuk kaydırıldığında
   * hiçbir şey söylemiyordu) ama tedavi yanlıştı: hiç şikâyet edilmemiş bir şeyi bozdu
   * ve logo tıklanabilir olduğu için komut paletinin tek girişini de götürdü.
   * Doğru çözüm ikisini AYNI yuvada sıraya koymak.
   */
  it('marka işareti duruyor ve tıklanabilir', () => {
    expect(src).toContain('<TazqLogo height={24} />');
    expect(src).toContain('onPress={handleLogoPress}');
  });

  it('logo ile başlık aynı yuvayı paylaşır — çapraz geçiş', () => {
    expect(header).toContain('inverseProgress');
    // İkisi de mutlak konumlu olmalı: akışta yer kapsalardı geçiş sırasında
    // birbirlerini iterlerdi.
    expect(header).toMatch(/centerOverlay: \{\s*position: 'absolute'/);
  });

  it('sönmüş logo dokunuşu yutmaz — görünmeyen tuzak olmasın', () => {
    expect(header).toContain("pointerEvents={collapsed ? 'none' : 'box-none'}");
  });

  /**
   * ÇUBUĞUN ZEMİNİ de kaydırmaya bağlı. iOS'ta büyük başlık gösterilirken nav bar
   * görünmezdir; ayraç ancak içerik altına girince belirir. Bir ara yalnız başlık
   * canlandırılmış, zemin hep açık bırakılmıştı: ortası boş ama çerçevesi çizili bir
   * araç çubuğu çıkıyordu ve göz onu "bitmemiş" diye okuyordu.
   */
  it('çubuğun zemini ve ayracı da kaydırmayla belirir', () => {
    expect(header).toContain('chromeOpacity');
    // Ayraç sabit stilde KALMAMALI, yoksa hep görünür olur.
    expect(header).not.toMatch(/bar: \{[^}]*borderBottomWidth/s);
  });

  it('başlık kaydırmaya bağlı — sabit bir eşik değil, ölçülen yükseklik', () => {
    expect(src).toContain('scrollY={scrollY}');
    expect(src).toContain('collapseAt={titleCollapseAt}');
    // Eşik selamlamanın ÖLÇÜLEN yüksekliğinden türemeli: punto dar ekranda 22,
    // geniş ekranda 28 ve uzun isim onu iki satıra taşırıyor. Sabit sayı bu üç
    // durumdan yalnız birinde doğru olurdu.
    expect(src).toContain('setHeroHeight(e.nativeEvent.layout.height)');
    expect(src).toMatch(/heroHeight - S\.lg/);
  });

  it('kaydırma UI thread\'inde — her karede React render etmez', () => {
    expect(src).toContain('useNativeDriver: true');
    expect(src).toContain('<Animated.ScrollView');
  });
});

/**
 * Komut paletinin (görev arama + akıllı hızlı ekleme) girişi marka işaretine dokunmak.
 * Logo bir ara kaldırıldığında bu özellik de sessizce erişilemez kalmıştı — bir daha
 * olmasın diye giriş test altında.
 */
describe('komut paleti erişilebilir', () => {
  const src = read('app/index.tsx');

  it('logonun bir işi var — paleti açar', () => {
    expect(src).toContain('const handleLogoPress = useCallback(');
    expect(src).toContain('setCommandPortalVisible(true)');
  });

  it('paleti açan tek yol odur — gizli ikinci bir tetik yok', () => {
    const opens = src.match(/setCommandPortalVisible\(true\)/g) ?? [];
    expect(opens).toHaveLength(1);
  });

  it('panel BEKLEMEDEN açılır', () => {
    // 220ms gecikme vardı (logo nabzı bitsin diye) — gözle görülür bir tepki
    // gecikmesiydi. Animasyon paletin arkasında sürebilir, beklemek gerekmiyor.
    const fn = src.match(/const handleLogoPress = useCallback\([\s\S]*?\n  \}, \[\]\);/)?.[0] ?? '';
    expect(fn).not.toContain('setTimeout');
    // Açılan yüzeyin karşılığı TEK `surface` — çift atış aynı olayı iki kez anlatıyordu.
    expect(fn.match(/haptic\./g) ?? []).toHaveLength(1);
    expect(fn).toContain('haptic.surface()');
  });
});

/**
 * APPLE'IN RENK KURALI — yüzeyler temiz, renk küçük ve doygun.
 *
 * İki dashboard kartının da üstünde köşegen bir renk yıkaması vardı: vurgu rengi kartın
 * TAMAMINA %12–28 opaklıkla seriliyordu. "Dekoratif" diye meşru sayılmıştı ama iki şeyi
 * birden bozuyordu — beyaz yüzeyi kirletiyor ve rengi anlam taşıyamayacak kadar
 * soluklaştırıyordu. %12'ye inen bir kırmızı "acil" demez, sadece ortamı boyar.
 *
 * iOS'ta renk üç yerde görünür ve hep TAM doygunlukta: kontroller (düğme), semboller,
 * veri görselleştirmesi (halka, grafik). Yüzeyin kendisi boyanmaz.
 */
describe('kart yüzeyleri temiz — renk veriye ait', () => {
  const CARDS = [
    'features/dashboard/components/TodayCard.tsx',
    'features/dashboard/components/NextMissionCard.tsx',
  ];

  it.each(CARDS)('%s kartın tamamına renk sermiyor', (rel) => {
    const src = read(rel);
    // `absoluteFill` + gradyan = yüzey yıkaması. SVG içindeki gradyan (halkanın kendisi)
    // ayrı bir şey: o veri görselleştirmesi, yüzey değil.
    expect(src).not.toMatch(/<LinearGradient[\s\S]*?StyleSheet\.absoluteFill/);
    expect(src).not.toContain("from 'expo-linear-gradient'");
  });

  /**
   * Halka çapın %10'u kalınlığındaydı; o oranda çizilen şey "halka" değil "ince çember"
   * gibi okunur. Yüzey yıkaması kalkınca sayfadaki tek canlı renk bu halka oldu —
   * görülebilmesi gerekiyor. Apple'ın Fitness halkaları çapın ~%18'i.
   */
  it('ilerleme halkası yeterince kalın — rengi taşıyabilmeli', () => {
    const src = read('features/dashboard/components/TodayCard.tsx');
    const ring = Number(src.match(/const RING = (\d+);/)?.[1]);
    const stroke = Number(src.match(/const RING_STROKE = (\d+);/)?.[1]);
    expect(stroke / ring).toBeGreaterThanOrEqual(0.12);
  });

  it('halkanın boş kısmı AYNI rengin soluk hâli — nötr gri değil', () => {
    // `theme.outline` ile çizilince halka "gri çember + renkli yay" yani iki ayrı nesne
    // gibi okunuyordu. Apple'ın halkalarında boşluk, o metriğin dolmamış kısmıdır.
    const src = read('features/dashboard/components/TodayCard.tsx');
    expect(src).toMatch(/stroke=\{accent \+ '1A'\}/);
  });
});

/**
 * İLERLEME HALKASI TEK HUE — marka rengi başka bir renge kaymaz.
 *
 * Yay `primary (#0B6BCB, hue 210) → secondary (#7C3AED, hue 262)` gradyanıyla
 * çiziliyordu. 52 derecelik bu sıçrama bir ton farkı değil, başka bir renktir: ekranda
 * ilerleme mavi değil MOR okunuyordu. Halka inceyken (9pt) görünmüyordu, kalınlaşınca
 * mor uç baskın oldu.
 *
 * Daha ağırı: Colors.ts'te marka mavisinin hue 221'den 210'a ÇEKİLDİĞİ yazılı, gerekçesi
 * de "221 indigo/mor tarafına bakıyor" ve "sert lacivert" şikayeti. Uygulamanın en
 * görünür veri görselleştirmesi o düzeltmeyi geri alıyordu.
 */
describe('ilerleme halkası — renk tek şey söyler', () => {
  const src = read('features/dashboard/components/TodayCard.tsx');

  it('halka çapraz-hue gradyan kullanmaz', () => {
    expect(src).not.toContain('ringGrad');
    expect(src).not.toContain('theme.secondary');
  });

  it('yay doğrudan durum rengiyle çizilir', () => {
    // mavi = devam ediyor, yeşil = bitti. Hedefe ulaşınca zaten iki durak da tertiary
    // olduğu için halka TEK renk oluyordu; "devam ediyor" kuralın dışındaki tek durumdu.
    expect(src).toContain('stroke={accent}');
  });
});

/**
 * Yuvayı 78pt'ye çıkarmak ve iki satıra almak gerekliydi ama yetmedi: adların bir kısmı
 * ad + koçluk detayı taşıyor ve detay tek başına iki satırı dolduruyor.
 * Ölçüm: 268 addan 27'si sığmıyordu → kırpma sonrası 13.
 */
describe('alışkanlık etiketi kompakt gösterimde kırpılır', () => {
  it('baloncuk ham başlığı değil kompakt etiketi çizer', () => {
    const src = read('features/habits/components/HabitBubble.tsx');
    expect(src).toContain('{compactHabitLabel(item.title)}');
    // Yorumlar hariç — gerekçede eski koddan SÖZ etmek serbest.
    expect(stripComments(src)).not.toContain('{item.title}');
  });
});

/**
 * MOMENTUM BLOĞU — sayfadaki tek "kartsız" öğe olmaktan çıktı.
 *
 * Gruplanmış-inset düzende (iOS Ayarlar deseni) kapsayıcısı olmayan bir öğe "sisteme
 * ait değil" diye okunur; göz onu içerik değil ARTIK sayar. Bu blok tam da selamlama
 * ile ilk kartın arasında, yani en görünür yerde duruyordu ve altı ayrı kural ihlalini
 * bir arada taşıyordu.
 */
describe('momentum bloğu sisteme ait', () => {
  const src = read('features/user/components/MomentumPulse.tsx');
  const code = stripComments(src);

  it('bir kart içinde', () => {
    expect(code).toContain('<BentoCard');
  });

  it('dikey saç teli ayraç yok — uygulamanın hiçbir yerinde olmayan bir desendi', () => {
    expect(code).not.toMatch(/width: 1, height: 36/);
  });

  it('ham rgba() rengi kalmadı — paletin dışına çıkmasın', () => {
    // Boş çubuk rengi ve ayraç tema başına elle yazılıydı; palet değişince
    // sessizce eskiyorlardı.
    const chart = code.slice(code.indexOf('const barColor'), code.indexOf('Trend'));
    expect(chart).not.toMatch(/rgba\(/);
  });

  it('renk kullanım yerinde KISILMIYOR', () => {
    // `opacity: 0.5` (etiket) ve `opacity: isToday ? 1 : 0.45` (çubuklar) vardı.
    // Çubuklarda renk skoru kodluyor; kısılınca kodlama okunamaz hâle geliyordu.
    expect(code).not.toContain('opacity: isToday');
    const label = code.match(/MOMENTUM[\s\S]{0,200}/)?.[0] ?? '';
    expect(label).not.toMatch(/opacity: 0\.\d/);
  });

  it('metin sembolü değil flat glif', () => {
    // `ⓘ` bir METİN karakteriydi: yazı tipine göre farklı çizilir, satır hizasına
    // oturmaz ve rengi paletle konuşmaz.
    expect(code).not.toContain('ⓘ');
    expect(code).toContain('<Info size={ICON.xs}');
  });

  it('punto ölçekten gelir — elle yazılmış 9pt yok', () => {
    expect(code).not.toMatch(/fontSize: 9,/);
  });
});

/**
 * YÜZEN EYLEM DÜĞMESİ — kayıtlı konum bugünün ekranına ait olmayabilir.
 *
 * Sürüklerken konum güvenli bölgeye kıstırılıyordu ama GERİ YÜKLERKEN kıstırılmıyordu;
 * depodaki sayı ne ise doğrudan uygulanıyordu. O sayı şu durumlarda geçersiz olur:
 * navbar yüksekliği değişti (106pt → 83pt, dosyanın kendi notu), katlanabilir cihaz
 * açıldı, tablet ile telefon aynı hesabı paylaşıyor, ekran döndü. Hepsinde düğme
 * erişilemeyecek bir yerde ya da ekran dışında kalabiliyordu.
 */
describe('yüzen eylem düğmesi konumu', () => {
  const src = read('shared/components/MagneticFAB.tsx');

  it('geri yüklenen konum güvenli bölgeye kıstırılır', () => {
    expect(src).toMatch(/Math\.max\(ceilY, Math\.min\(floorY, storedNumY\)\)/);
  });

  it('bozuk kayıt sessizce geçmez', () => {
    // `parseFloat` başarısız olunca NaN dönüyor ve kontrolsüz geçiyordu.
    expect(src).toContain('Number.isFinite(storedNumX)');
    expect(src).toContain('Number.isFinite(storedNumY)');
  });

  it('kenar boşluğu TEK sabitten — yükleme ve sürükleme ayrışamaz', () => {
    // 16 iki yerde ayrı yazılıydı; biri değişirse düğme yüklendiği yerden farklı bir
    // yere yapışırdı.
    expect(src).toContain('const EDGE_MARGIN = S.md;');
    expect(stripComments(src)).not.toMatch(/const margin = 16;/);
  });
});
