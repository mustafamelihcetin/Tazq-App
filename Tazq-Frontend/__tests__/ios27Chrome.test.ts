/**
 * iOS 26/27 CHROME BENİMSEMESİ — ve Android'in korunması.
 *
 * ── NEDEN ─────────────────────────────────────────────────────────────────────
 * Sekme çubuğu bir süre UIKit'in Liquid Glass ÖNCESİ ölçüsüne göre kurulmuştu:
 * 49pt içerik, dibe yapışık, tam genişlik, hairline ayraç. O ölçü doğruydu — ta ki
 * iOS 26 sistem sekme çubuğunu kenarlardan içeri alınmış, kapsül biçimli, içeriğin
 * ÜZERİNDE yüzen bir cam şeride çevirene kadar. Hizalandığımız hedef yer değiştirdi.
 *
 * ── BU DOSYA NEYİ KORUYOR ─────────────────────────────────────────────────────
 *  1. iOS'ta yeni davranışın GERÇEKTEN kurulu olduğunu
 *  2. Android'in bu turda HİÇ değişmediğini — platform dallanması sessizce
 *     tek-platforma çökerse Android kullanıcıları yabancı bir çubuk görür
 *  3. Erişilebilirlik tercihlerinin cam ve hareketi ezdiğini
 *
 * NOT: jest `Platform.OS === 'ios'` altında koşar. Android tarafı, çalışma anı
 * değerleriyle değil KAYNAKTAKİ dallanmayla sınanıyor — tek yol bu.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

const NAV = stripComments(read('shared/components/BottomNavBar.tsx'));
const BLUR = stripComments(read('shared/components/AppBlur.tsx'));
const ISLAND = stripComments(read('features/focus/components/FocusIsland.tsx'));

describe('cam malzeme', () => {
  it('iOS 26+ için gerçek sistem camı kullanılıyor', () => {
    expect(BLUR).toContain("require('expo-glass-effect')");
    expect(BLUR).toContain('GlassView');
  });

  it('modül yoksa ÇÖKMEZ — eski blur yolu çalışır', () => {
    // Native modül eski bir derlemede yoksa `require` patlar. Savunmacı yükleme,
    // uygulamanın geri kalanının çalışmaya devam etmesini sağlıyor.
    expect(BLUR).toMatch(/try\s*\{\s*GlassModule = require\('expo-glass-effect'\);/);
    expect(BLUR).toContain('BlurView'); // yedek yol duruyor
  });

  it('çalışma anı kontrolü İKİ kapılı — beta iOS 26 sürümlerinde çökmesin', () => {
    expect(BLUR).toContain('isLiquidGlassAvailable');
    expect(BLUR).toContain('isGlassEffectAPIAvailable');
  });

  it('cam UYGULAMANIN temasını izler — sistemin değil', () => {
    /*
      Cam varsayılan olarak SİSTEM görünümünü izler. Kullanıcı uygulamada koyu tema
      seçmişken telefon açık temadaysa yüzey açık kalır ve üstündeki koyu içerikle
      çakışır. (Aynı hata expo-router'ın native sekmelerinde "koyu temada titreme"
      olarak raporlanmıştı.)
    */
    expect(BLUR).toContain('colorScheme={tint ?? colorScheme}');
  });

  it('ANDROID cam yoluna HİÇ girmez', () => {
    const fn = BLUR.slice(BLUR.indexOf('function canUseGlass'), BLUR.indexOf('function canUseGlass') + 400);
    expect(fn).toContain("Platform.OS !== 'ios'");
  });
});

describe('erişilebilirlik tercihleri camı EZER', () => {
  it('"Şeffaflığı Azalt" açıksa opak yüzey — cam da blur da yok', () => {
    /*
      Sıra AppBlur'ün KENDİ gövdesinde aranıyor: dosyada artık ondan önce tanımlı
      başka bir bulanık bileşen de var (BlurEdge, kademeli kenar). Onun `<BlurView`u
      bu sıralamanın parçası değil — o bileşen tercihi kendi başında kontrol ediyor.
    */
    const body = BLUR.slice(BLUR.indexOf('export const AppBlur = ('));
    const idx = body.indexOf('if (reduceTransparency)');
    expect(idx).toBeGreaterThan(-1);
    // Kontrol HER İKİ malzeme yolundan da ÖNCE gelmeli; sonra gelseydi cam onu atlardı.
    // Fonksiyon TANIMI değil ÇAĞRI aranıyor — tanım dosyanın başında duruyor.
    expect(idx).toBeLessThan(body.indexOf('if (canUseGlass()'));
    expect(idx).toBeLessThan(body.indexOf('<BlurView'));
    // Sönümlenen blur yolu da aynı tercihin ARDINDA (bkz. aşağıdaki dikiş testleri).
  });

  it('tercih gerçekten sistemden okunuyor', () => {
    const hook = read('shared/hooks/useReduceTransparency.ts');
    expect(hook).toContain('isReduceTransparencyEnabled');
    expect(hook).toContain('reduceTransparencyChanged'); // değişimi de dinliyor
  });

  it('"Hareketi Azalt" açıksa çubuk HİÇ küçülmez', () => {
    // Küçülmenin tek gerekçesi zarif geçiş; animasyonsuz iki boy arasında ZIPLAR.
    const hook = read('shared/hooks/useChromeMinimizeOnScroll.ts');
    expect(hook).toContain('isReduceMotionEnabled');
    expect(hook).toContain('if (reduceMotion.current) return;');
  });
});

describe('kaydırmada küçülme', () => {
  const HOOK = read('shared/hooks/useChromeMinimizeOnScroll.ts');

  it('YALNIZ iOS — Android gezinme çubuğu kaydırmayla küçülmez', () => {
    expect(HOOK).toContain("if (Platform.OS !== 'ios') return;");
    // Çubuk tarafında ikinci kapı: biri unutulursa diğeri tutar.
    expect(NAV).toMatch(/useChromeStore\(s => s\.minimized\) && IS_IOS/);
  });

  it('eşik var — parmağın en ufak oynaması çubuğu titretmesin', () => {
    expect(HOOK).toMatch(/const THRESHOLD = \d+/);
    expect(HOOK).toContain('accum.current');
  });

  it('sayfa tepesinde çubuk DAİMA açık', () => {
    expect(HOOK).toContain('TOP_ZONE');
    expect(HOOK).toMatch(/value <= TOP_ZONE[\s\S]{0,200}setMinimized\(false\)/);
  });

  it('ekrandan çıkarken açık bırakılır — sonraki ekran küçük açılmasın', () => {
    const cleanup = HOOK.slice(HOOK.indexOf('return () => {'), HOOK.length);
    expect(cleanup).toContain('setMinimized(false)');
  });

  it('sinyal sekmeli DÖRT ekranın hepsine bağlı', () => {
    // Üçü ortak kaydırma hook\'undan, ana sayfa kendi değerinden.
    expect(read('shared/hooks/useCollapsibleHeader.ts')).toContain('useChromeMinimizeOnScroll(scrollY)');
    expect(read('app/index.tsx')).toContain('useChromeMinimizeOnScroll(scrollY)');
    for (const f of ['app/tasks.tsx', 'app/cockpit.tsx', 'app/modlar.tsx']) {
      expect(read(f)).toContain('useCollapsibleHeader');
    }
  });

  it('her karede store yazılmaz — yalnız DEĞİŞİM', () => {
    // Aksi hâlde çubuk saniyede 60 kez yeniden çizilirdi.
    const store = read('shared/store/useChromeStore.ts');
    expect(store).toMatch(/s\.minimized === minimized \? s :/);
  });
});

describe('sekme çubuğu yerleşimi', () => {
  it('ARAMA ÇUBUKTA YOK — Görevler ekranında zaten var', () => {
    /*
      Bir tur, kapsülün sağında ayrı bir dairesel arama adası denendi (iOS 26/27
      deseni). Geri alındı: arama zaten Görevler ekranının içinde ve ikinci bir
      giriş altıncı bir hedef ekleyip çubuğu daraltıyordu. Desene uymak, ihtiyaç
      olmayan bir şeyi eklemek için gerekçe değil.
    */
    expect(NAV).not.toContain('searchIsland');
    expect(NAV).not.toContain('focusSearch');
    // Görevler ekranı da artık böyle bir parametre beklemiyor.
    expect(read('app/tasks.tsx')).not.toContain('focusSearch');
  });

  it('etiket SIĞMIYORSA gizlenir, kırpılmaz', () => {
    // "Ana Say…" hem daha az bilgi taşır hem daha kalabalık durur.
    expect(NAV).toContain('showLabels');
    expect(NAV).toContain('labelFits');
    expect(NAV).toContain('numberOfLines={1}');
  });

  it('ölçü CANLI — döndürme, katlanır ekran ve Dynamic Type', () => {
    expect(NAV).toContain('useWindowDimensions');
    expect(NAV).toMatch(/NAV_LABEL_MIN_TAB_WIDTH \* Math\.max\(fontScale, 1\)/);
    // Geniş ekranda içerik sütunuyla aynı sınır — sekmeler sonsuza yayılmaz.
    expect(NAV).toContain('Math.min(winW, MAX_W)');
  });

  it('sekme SAYISI hesaba katılıyor — Sade modda 3, Pro tarafında 5', () => {
    expect(NAV).toMatch(/usableWidth \/ Math\.max\(tabs\.length, 1\)/);
  });

  it('etiket gizlense de İKON yerinde — dokunma hedefi kaymaz', () => {
    // İkon koşulsuz çiziliyor; yalnız `<Text>` koşullu.
    const inner = NAV.slice(NAV.indexOf('<View style={styles.tabInner}>'), NAV.indexOf('</View>', NAV.indexOf('<View style={styles.tabInner}>')) + 800);
    expect(inner).toContain('size={NAV_ICON_SIZE}');
    expect(inner).toMatch(/\{showLabels && \(/);
  });

  it('kapsülün iç payı var — içerik yuvarlak uca dayanmaz', () => {
    expect(NAV).toContain('paddingHorizontal: NAV_CAPSULE_PAD');
  });
});

describe('etiket tabloları DOĞRU yerde', () => {
  /**
   * İki tablonun değerleri bir noktada birbirine karışmıştı: BARDA "Derin Odak" ve
   * "Yaşam Modları" (uzun) yazıyor, EKRAN OKUYUCUYA "Odak" ve "Modlar" (kısa)
   * okunuyordu — her iki yorumun da söylediğinin tersi. Görsel tarafta bu doğrudan
   * sıkışıklık üretiyordu ("Yaşam Modları" 13 karakter), sesli tarafta ise kullanıcı
   * özelliği aradığı adla duymuyordu.
   */
  it('BARDA kısa ad yazar', () => {
    const short = NAV.slice(NAV.indexOf('const TAB_SHORT'), NAV.indexOf('const TAB_LABELS'));
    expect(short).toContain("focus: { tr: 'Odak'");
    expect(short).toContain("modlar: { tr: 'Modlar'");
    expect(short).not.toContain('Derin Odak');
    expect(short).not.toContain('Yaşam Modları');
  });

  it('EKRAN OKUYUCUYA tam ad okunur', () => {
    const labels = NAV.slice(NAV.indexOf('const TAB_LABELS'));
    expect(labels).toContain("focus: { tr: 'Derin Odak'");
    expect(labels).toContain("modlar: { tr: 'Yaşam Modları'");
  });

  it('görünen metin kısa tablodan, sesli ad tam tablodan geliyor', () => {
    expect(NAV).toContain('TAB_SHORT[tab.id].tr');
    expect(NAV).toContain('accessibilityLabel={tr ? TAB_LABELS[tab.id].tr : TAB_LABELS[tab.id].en}');
  });
});

describe('odak hapı sekme çubuğunun üstünde', () => {
  it('artık ekranın TEPESİNDE değil', () => {
    // Eski konum Dynamic Island tarafındaydı; orada zaten avatar, marka işareti
    // ve durum rozeti var. Süren bir iş bildirim değil, aksesuardır.
    expect(ISLAND).not.toContain('top: insets.top + 8');
    expect(ISLAND).toContain('bottomOffset');
  });

  it('sekme çubuğu OLAN ve OLMAYAN ekranı ayırt eder', () => {
    expect(ISLAND).toContain('hasNavBar');
    expect(ISLAND).toMatch(/hasNavBar\s*\?[\s\S]{0,160}:\s*insets\.bottom/);
  });

  it('çubuk küçülünce hap da iner — tek hareket gibi okunmalı', () => {
    expect(ISLAND).toContain('NAV_BAR_MINIMIZED_HEIGHT');
    // Süre sekme çubuğununkiyle aynı olmalı.
    expect(ISLAND).toContain('duration: 220');
    expect(NAV).toContain('duration: 220');
  });

  it('aşağıdan doğar — tepeden inmiyor', () => {
    expect(ISLAND).toMatch(/from=\{\{ translateY: 24/);
  });
});

describe('Android bu turda DEĞİŞMEDİ', () => {
  const TOKENS = read('shared/constants/tokens.ts');

  it('geometri platforma göre dallanıyor — tek platforma çökmemiş', () => {
    expect(TOKENS).toMatch(/NAV_BAR_LIFT = Platform\.OS === 'ios' \? 8 : 0/);
    expect(TOKENS).toMatch(/NAV_BAR_SIDE_INSET = Platform\.OS === 'ios' \? 16 : 0/);
    expect(TOKENS).toMatch(/NAV_BAR_RADIUS = Platform\.OS === 'ios' \? 999 : 0/);
  });

  it('Android çubuğu opak kalır — cam yalnız iOS\'ta', () => {
    expect(NAV).toMatch(/backgroundColor: IS_IOS \? 'transparent' : theme\.surfaceFloating/);
    expect(NAV).toMatch(/\{IS_IOS && <AppBlur material="chrome"/);
  });

  it('ayraç çizgisi YALNIZ yapışık çubukta — yüzen kapsülde anlamsız', () => {
    expect(NAV).toMatch(/borderTopWidth: IS_IOS \? 0 : HAIRLINE/);
  });

  it('cam/blur katmanı KENDİ yarıçapını bilir — köşeleri kabın dışına taşmaz', () => {
    /*
      ÖLÇÜLEN SORUN: yuvarlak bir kabın (`borderRadius` + `overflow:'hidden'`) içine
      konan bulanık/cam katman kabın şeklini almıyordu; kare çiziliyor ve köşeleri
      dairenin içinde görünüyordu. Ana sayfadaki durum düğmesinde birebir bu oldu.
      Ebeveynin kırpması bu katmanlarda güvenilir değil — malzeme kendi şeklini
      bilmek zorunda.
    */
    expect(NAV).toContain('radius={NAV_BAR_RADIUS}');
    expect(read('features/dashboard/components/StatusHub.tsx')).toContain('radius={HUB / 2}');
    expect(BLUR).toContain('radius != null && { borderRadius: radius }');
  });
});

describe('cam sayfalar ve eşmerkezli köşeler', () => {
  const SHEET = read('shared/components/GlassSheet.tsx');
  const { R, concentric, S } = require('@/shared/constants/tokens');

  it('içerik ölçeği BÜYÜTÜLMEDİ — yeni bant üstüne eklendi', () => {
    /*
      md/lg/xl iOS'un Liquid Glass ÖNCESİ kart değerlerine hizalı ve İÇERİK için hâlâ
      doğru: aşırı yuvarlak kart ucuz template estetiğidir, o karar ölçülerek verildi.
      Cam KABUK ayrı bir mesele — bu yüzden ölçek büyütülmedi, üstüne adım eklendi.
    */
    expect(R.sheet).toBeGreaterThan(R.xl);
    expect(R.md).toBeLessThanOrEqual(12 * 1.125);
    expect(R.lg).toBeLessThanOrEqual(16 * 1.125);
  });

  it('eşmerkezli kural: iç yarıçap = dış − boşluk', () => {
    // Ancak o zaman iki eğri PARALEL kalır ve göz onları tek nesne gibi okur.
    expect(concentric(28, 16)).toBe(12);
    expect(concentric(40, 8)).toBe(32);
  });

  it('eşmerkezli sonuç sıfıra düşmez — eğri ilişkisi kopmasın', () => {
    expect(concentric(10, 100)).toBeGreaterThan(0);
    expect(concentric(10, 100)).toBeLessThanOrEqual(R.xs);
  });

  it('sayfa iç yarıçapını KENDİ dolgusundan türetir', () => {
    expect(SHEET).toContain('concentric(R.sheet, padding, R.md)');
    expect(SHEET).toContain('sheetInnerRadius');
  });

  it('eşmerkezlilik kenara YAKIN iç öğe içindir — uzak içerik kartı kendi yarıçapını korur', () => {
    /*
      Dolgu 24 iken formül 28 − 24 = 4 verir: içerik kartı neredeyse köşeli olurdu.
      Apple'ın ConcentricRectangle'ı da "dış − boşluk, ama bir minimumdan küçük değil"
      diye çalışır. Minimum içerik kartının doğal yarıçapı (R.md).
    */
    expect(concentric(R.sheet, S.lg, R.md)).toBe(R.md);
    expect(concentric(R.sheet, S.xs, R.md)).toBe(R.sheet - S.xs);
  });
});

describe('cam yüzey — bütün modallar tek zeminden', () => {
  const SURFACE = stripComments(read('shared/components/GlassSurface.tsx'));

  function walk(dir: string): string[] {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) return [];
    return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) return walk(rel);
      return e.name.endsWith('.tsx') ? [rel] : [];
    });
  }
  const FILES = ['app', 'shared', 'features'].flatMap(walk);

  it('cam TEK BAŞINA kontrast garanti etmez — ton katmanı var', () => {
    /*
      Saf cam üstünde metin okunmaz: arkadaki içerik kaydıkça kontrast oynar ve bir
      anda AA'nın altına düşer. Apple'ın sayfaları da saf cam değil.
    */
    const idx = SURFACE.indexOf('VEIL_OPACITY = {');
    expect(idx).toBeGreaterThan(-1);
    expect(SURFACE.slice(idx, idx + 60)).toMatch(/light: 0\.\d+, dark: 0\.\d+/);
  });

  it('ton opaklığı TEK yerde — hiçbir yüzey kendi sayısını uydurmaz', () => {
    /*
      AppBlur'ün "17 çağrıda 12 farklı sayı" hatasının aynısına düşmemek için.

      NOT: bir tur ÇUBUKLARA da ton katmanı eklendi (başlığın arkası cam olduğu için
      içerik görünüyordu). GERİ ALINDI — katman camı tamamen öldürüyordu, yani sorunu
      çözerken iOS 26 malzemesinin kendisini yok ediyordu. Çubuklar SAF cam kalır;
      ton katmanı yalnız sayfa/modal yüzeylerinde.
    */
    const offenders = FILES.filter(
      (f) => f !== 'shared/components/GlassSurface.tsx' && read(f).includes('VEIL_OPACITY'),
    );
    expect(offenders).toEqual([]);
  });

  it('Android cam almaz — opak yüzey, bu turdan önceki gibi', () => {
    expect(SURFACE).toMatch(/Platform\.OS !== 'ios'\)\s*\{\s*return <View[^>]*backgroundColor: fill/);
  });

  it('dibe yapışık sayfada alt köşeler ekranın DIŞINA taşınır', () => {
    /*
      Köşe başına yarıçap yedek bulanıklık katmanında cihazda doğrulanmadı. Eşit
      yarıçap + alt kenarı yarıçap kadar uzatmak üç malzeme yolunda da çalışan tek biçim.
    */
    expect(SURFACE).toMatch(/corners === 'top'[\s\S]{0,120}bottom: -radius/);
  });

  it('modal açan HER dosya cam yüzey kullanır — opak zemin geri gelemez', () => {
    /*
      ÖLÇÜLEN SORUN: 21 dosyadaki 29 modal kendi opak zeminini çiziyordu (#1C1C1E,
      #1C1C22, #1A1A1A, theme.surface…). Kullanıcı çubukları cam, açtığı sayfayı opak
      görüyordu. Yeni bir modal eklenirse bu test onu da yakalar.
    */
    const offenders = FILES
      .map((f) => {
        const src = read(f);
        const modals = (src.match(/<Modal\b/g) ?? []).length;
        const glass = (src.match(/<GlassSurface\b|<GlassSheet\b|<GlassCard[^>]*floating/g) ?? []).length;
        return { f, modals, glass };
      })
      .filter(({ modals, glass }) => modals > 0 && glass < modals)
      .map(({ f, modals, glass }) => `${f}: ${modals} modal, ${glass} cam yüzey`);
    expect(offenders).toEqual([]);
  });

  it('eski elle yazılmış sayfa zeminleri kalmadı', () => {
    const offenders = FILES.filter((f) =>
      /backgroundColor: isDark \? '#1C1C1E' : '#FFFFFF',\s*paddingBottom|'#1A1A1A' : '#FFFFFF'/.test(read(f)),
    );
    expect(offenders).toEqual([]);
  });
});

describe('üst bar da iOS 26/27 davranışında', () => {
  const HEADER = stripComments(read('shared/components/ScreenHeader.tsx'));
  const SHELL = stripComments(read('shared/components/ChromeShell.tsx'));
  const TOKENS = require('@/shared/constants/tokens');

  /*
    ── BİR DENEME GERİ ALINDI ────────────────────────────────────────────────────
    Başlık çubuğu da sekme çubuğu gibi kaydırınca 44→36pt küçültülmüştü. Küçülen
    çubuktan DÜĞMELER TAŞTI: dokunma hedefi 44pt (Apple HIG alt sınırı) ve o hedef
    küçülemez. Sekme çubuğu küçülebiliyor çünkü içindeki hedefler onunla birlikte
    küçülüyor; başlık çubuğununkiler küçülemez.

    Chrome'un geri çekilmesi artık YÜKSEKLİKLE değil MALZEMEYLE anlatılıyor.
  */
  it('başlık çubuğunun yüksekliği SABİT — düğmeler taşamaz', () => {
    expect(HEADER).toContain('<View style={styles.content}>');
    expect(HEADER).not.toContain('TOP_BAR_MINIMIZED_HEIGHT');
    expect(HEADER).not.toContain('useChromeStore');
    expect(TOKENS.TOP_BAR_MINIMIZED_HEIGHT).toBeUndefined();
  });

  it('düğme kabuğu dokunma hedefinden KÜÇÜK — avatarla aynı bant', () => {
    /*
      Kabuk önce hedefi tamamen dolduruyordu (40–44pt) ve 44pt'lik çubukta kenarlara
      dayanıyordu. Görsel boyut ile erişilebilir alan aynı şey değil.
    */
    expect(SHELL).toContain('size = TOP_ITEM_SIZE');
    expect(TOKENS.TOP_ITEM_SIZE).toBeLessThan(TOKENS.TOP_BAR_HEIGHT);
    // Hedef hâlâ 44pt: küçülen tek şey görünen daire.
    expect(HEADER).toContain('width: MIN_TOUCH, height: MIN_TOUCH');
  });

  it('düğme kabuğu Android\'de HİÇ çizilmez — Material düğmesi çıplak gliftir', () => {
    expect(SHELL).toMatch(/Platform\.OS !== 'ios'\) return null/);
  });

  it('kabuk yer KAPLAMAZ — düzen iki platformda da aynı kalır', () => {
    expect(SHELL).toContain('StyleSheet.absoluteFill');
  });

  it('geri düğmesi ve ekran düğmeleri aynı kabuğu kullanır', () => {
    // Aynı çubuktaki düğmeler iki farklı dil konuşmasın (durum düğmesinin kabuğu vardı).
    expect(HEADER).toContain('<ChromeShell />');
    for (const f of ['app/tasks.tsx', 'app/cockpit.tsx', 'app/modlar.tsx']) {
      expect(read(f)).toContain('<ChromeShell />');
    }
  });
});

describe('renkli cam — süren iş durgun yüzeyle aynı renkte olmaz', () => {
  const ISLAND = stripComments(read('features/focus/components/FocusIsland.tsx'));

  it('cam sistemin KENDİ tonlamasını alır, bindirilmiş katman değil', () => {
    expect(BLUR).toContain('tintColor={glassTint}');
  });

  it('cam yokken ton ince bir katmana düşer — durum korunur', () => {
    expect(BLUR).toContain('TINT_FALLBACK_OPACITY');
    expect(BLUR).toMatch(/TINT_FALLBACK_OPACITY = 0\.\d+/);
  });

  it('odak hapı seansın rengini taşır', () => {
    expect(ISLAND).toContain('glassTint={theme.primary}');
  });

  it('Android hapı OPAK kalır — cam yalnız iOS', () => {
    expect(ISLAND).toMatch(/Platform\.OS === 'ios' \? 'transparent' :/);
    expect(ISLAND).toMatch(/\{Platform\.OS === 'ios' && \(\s*<AppBlur material="chrome"/);
  });
});

describe('ikon kısayolları', () => {
  const HOOK = stripComments(read('shared/hooks/useAppShortcuts.ts'));

  it('native modül YOKSA uygulama çalışmaya devam eder', () => {
    /*
      `expo-quick-actions` native bir modül; eski bir geliştirme derlemesinde yoksa
      düz `require` patlar. Cam malzeme ve Google Sign-In ile aynı savunmacı desen.
    */
    expect(HOOK).toMatch(/try\s*\{\s*QuickActions = require\('expo-quick-actions'\);/);
    expect(HOOK).toContain('if (!QuickActions?.setItems) return;');
    expect(HOOK).toContain('if (!QuickActions?.addListener) return;');
  });

  it('iki kısayol var ve metinleri SÖZLÜKTEN geliyor', () => {
    // Kısayol yazısı işletim sisteminde görünür ama uygulamanın dilini konuşmalı.
    expect(HOOK).toContain('t.shortcuts.addTask');
    expect(HOOK).toContain('t.shortcuts.focus');
    expect(HOOK).toMatch(/\}, \[language, t\]\);/); // dil değişince tazelenir
  });

  it('kısayolla AÇILIŞ da yakalanıyor — dinleyici geç kurulur', () => {
    expect(HOOK).toContain('if (QuickActions.initial) handle(QuickActions.initial);');
  });

  it('görev kısayolu MEVCUT bağlantıyı kullanıyor — ikinci bir yol açılmadı', () => {
    expect(HOOK).toContain("params: { action: 'add' }");
    expect(read('app/tasks.tsx')).toContain("if (action === 'add')");
  });

  it('odak kısayolu seansı KENDİLİĞİNDEN başlatmıyor', () => {
    // Süre ve mod seçimi kullanıcının; yanlış süreyle başlamış seansı durdurmak,
    // hiç başlamamış olmaktan kötüdür.
    expect(HOOK).toContain("router.push('/focus')");
    expect(HOOK).not.toContain('startFocus');
  });

  it('kök düzende DEĞİL ana ekranda bağlı — gezinme ağacı hazır olmalı', () => {
    expect(read('app/index.tsx')).toContain('useAppShortcuts()');
    expect(read('app/_layout.tsx')).not.toContain('useAppShortcuts');
  });
});

describe('çubuğun alt kenarında DİKİŞ yok — blur ÇUBUĞUN İÇİNDE sönümleniyor', () => {
  const HEADER = stripComments(read('shared/components/ScreenHeader.tsx'));
  const TOKENS = require('@/shared/constants/tokens');

  /*
    ── ÜÇ DENEME GERİ ALINDI, DÖRDÜNCÜSÜ DURUYOR ────────────────────────────────
     1. RENK gradyanı (sayfa zemininden saydama): sayfanın üstünde açıklanamayan bir
        şerit gibi okundu, çubuğun arkası hâlâ şeffaftı.
     2. TON KATMANI (yarı opak yüzey): sorunu çözdü ama camı tamamen öldürdü.
     3. ÇUBUĞUN ALTINA kademeli bant: sayfadan yer çaldı ve "çubukta blur yok, altına
        konmuş" gibi okundu.
     4. ÇUBUĞUN İÇİNDE sönümleme: üstte tam bulanıklık, alt kenarda sıfır. Altına
        hiçbir şey eklenmiyor, kesecek bir sınır da kalmıyor. İstenen buydu.
  */
  it('blur ÇUBUĞUN KENDİSİNDE — altına hiçbir katman eklenmiyor', () => {
    expect(HEADER).toContain('<AppBlur material="chrome" fadeBottom />');
    expect(HEADER).not.toContain('BlurEdge');
    expect(HEADER).not.toContain('ScrollEdge');
    // Ton katmanı ve renk gradyanı geri gelmesin.
    expect(BLUR).not.toContain('CHROME_VEIL_OPACITY');
    expect(BLUR).not.toContain('LinearGradient');
  });

  it('başlık çubuğu berrak cam DEĞİL — cam yolu atlanıyor', () => {
    // Cam altından geçeni gösteriyor; başlıkta bu "çıplaklık" demek.
    expect(BLUR).toContain('if (canUseGlass() && !fadeBottom)');
  });

  it('sönümleme kademeli — tek katman değil, üst üste binen katmanlar', () => {
    expect(BLUR).toContain('FADE_STEPS');
    const steps = BLUR.match(/intensity: (\d+)/g) ?? [];
    expect(steps.length).toBeGreaterThanOrEqual(4);
  });

  it('en zayıf katman ALT kenarda — dikiş orada oluşur', () => {
    /*
      `bottomInset: 0` katmanı çubuğun ta altına kadar uzanan tek katman; yoğunluğu
      en düşük olmalı, yoksa kenarda yine kesme görünür.
    */
    const idx = BLUR.indexOf('const FADE_STEPS');
    const block = BLUR.slice(idx, BLUR.indexOf('];', idx));
    const lines = block.split('\n').filter(l => l.includes('bottomInset'));
    const last = lines[lines.length - 1];
    expect(last).toContain('bottomInset: 0');
    const lastIntensity = Number((last.match(/intensity: (\d+)/) ?? [])[1]);
    const firstIntensity = Number((lines[0].match(/intensity: (\d+)/) ?? [])[1]);
    expect(lastIntensity).toBeLessThan(firstIntensity);
    expect(lastIntensity).toBeLessThan(10);
  });

  it('sönümleme payı çubuğun içinde kalır — sayfadan yer çalmaz', () => {
    expect(TOKENS.CHROME_FADE_HEIGHT).toBeLessThan(TOKENS.TOP_BAR_HEIGHT / 2);
  });

  it('Android ve "Şeffaflığı Azalt" — sönümleme yolu hiç çalışmaz', () => {
    expect(BLUR).toContain("if (fadeBottom && Platform.OS === 'ios')");
    const reduceIdx = BLUR.indexOf('if (reduceTransparency)');
    expect(reduceIdx).toBeLessThan(BLUR.indexOf("if (fadeBottom && Platform.OS === 'ios')"));
  });

  it('ayraç çizgisi de yok — sınırı tamamen malzeme söylüyor', () => {
    expect(HEADER).not.toContain('borderBottomWidth');
  });
});

describe('üst bar düğmeleri TEK bant — ekranlar ayrışamaz', () => {
  const FILES = [
    'shared/components/ScreenHeader.tsx',
    'app/tasks.tsx',
    'app/cockpit.tsx',
    'app/modlar.tsx',
  ];

  /*
    ── ÖLÇÜLEN SORUN ────────────────────────────────────────────────────────────
    Kabuklar (32pt cam daire) eklendikten sonra düğmeler "göze batmaya" başladı.
    İki sebep vardı ve ikisi de kabuktan ÖNCE de duruyordu, sadece görünmüyordu:

      1. Glif boyutu: üst bar düğmeleri ICON.lg (24), aynı çubuktaki durum düğmesi
         ICON.md (20). 32pt dairede 24pt glif kenarda 4pt bırakıyor — tıka basa.
      2. Mürekkep: Modlar ekranı `onSurfaceVariant` (soluk), diğerleri `onSurface`.
         Yani aynı görünen düğme, ekrana göre farklı renkteydi.
  */
  it('kabuk içindeki her glif ICON.md — durum düğmesi ve avatarla aynı bant', () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      const src = stripComments(read(f));
      let i = src.indexOf('<ChromeShell />');
      while (i !== -1) {
        const after = src.slice(i, i + 400);
        if (!after.includes('size={ICON.md}')) offenders.push(`${f} @${i}`);
        i = src.indexOf('<ChromeShell />', i + 1);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('hiçbir üst bar düğmesi ICON.lg kullanmaz', () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      const src = stripComments(read(f));
      let i = src.indexOf('<ChromeShell />');
      while (i !== -1) {
        if (src.slice(i, i + 400).includes('size={ICON.lg}')) offenders.push(f);
        i = src.indexOf('<ChromeShell />', i + 1);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('mürekkep her ekranda aynı — soluk varyant kullanılmaz', () => {
    for (const f of ['app/modlar.tsx', 'app/cockpit.tsx']) {
      const src = stripComments(read(f));
      let i = src.indexOf('<ChromeShell />');
      while (i !== -1) {
        expect(src.slice(i, i + 400)).not.toContain('theme.onSurfaceVariant');
        i = src.indexOf('<ChromeShell />', i + 1);
      }
    }
  });

  it('durum düğmesi de aynı bantta — referans bozulmasın', () => {
    const hub = stripComments(read('features/dashboard/components/StatusHub.tsx'));
    expect(hub).toContain('size={ICON.md}');
    expect(hub).toContain('const HUB = TOP_ITEM_SIZE;');
  });
});
