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
    const idx = BLUR.indexOf('if (reduceTransparency)');
    expect(idx).toBeGreaterThan(-1);
    // Kontrol HER İKİ malzeme yolundan da ÖNCE gelmeli; sonra gelseydi cam onu atlardı.
    // Fonksiyon TANIMI değil ÇAĞRI aranıyor — tanım dosyanın başında duruyor.
    expect(idx).toBeLessThan(BLUR.indexOf('if (canUseGlass())'));
    expect(idx).toBeLessThan(BLUR.indexOf('<BlurView'));
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
    expect(SHEET).toContain('concentric(R.sheet, padding)');
    expect(SHEET).toContain('sheetInnerRadius');
  });

  it('cam TEK BAŞINA kontrast garanti etmez — ton katmanı var', () => {
    /*
      Saf cam üstünde metin okunmaz: arkadaki içerik kaydıkça kontrast oynar ve bir
      anda AA'nın altına düşer. Apple'ın sayfaları da saf cam değil.
    */
    expect(SHEET).toContain('VEIL_OPACITY');
    const idx = SHEET.indexOf('VEIL_OPACITY = {');
    expect(SHEET.slice(idx, idx + 120)).toMatch(/light: 0\.\d+, dark: 0\.\d+/);
  });

  it('ton opaklığı TEK yerde — her modalda yeniden uydurulmasın', () => {
    // AppBlur'ün "17 çağrıda 12 farklı sayı" hatasının aynısına düşmemek için.
    expect((SHEET.match(/VEIL_OPACITY/g) ?? []).length).toBe(2); // tanım + kullanım
  });

  it('Android cam almaz — yüzey yükseltiyle ayrılır', () => {
    expect(SHEET).toMatch(/Platform\.OS === 'android'[\s\S]{0,40}elevation/);
  });

  it('taşınan sayfalar kendi zeminini ARTIK çizmiyor', () => {
    for (const f of ['features/user/components/DeleteAccountModal.tsx', 'shared/components/NotificationPrimer.tsx']) {
      const src = read(f);
      expect(src).toContain('<GlassSheet>');
      expect(src).not.toMatch(/backgroundColor: isDark \? theme\.surfaceContainerHigh/);
    }
  });
});
