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

describe('arama adası', () => {
  it('kapsülün DIŞINDA, ayrı bir ada', () => {
    expect(NAV).toContain('searchIsland');
    // Sekme dizisine eklenmemeli — orası kapsülün içeriği.
    const tabs = NAV.slice(NAV.indexOf('const allTabs'), NAV.indexOf('];', NAV.indexOf('const allTabs')));
    expect(tabs).not.toContain('search');
  });

  it('ANDROID\'DE YOK — Material\'da ayrık ada deseni yok', () => {
    expect(NAV).toMatch(/\{IS_IOS && \(\s*<MotiView[\s\S]{0,400}searchIsland/);
  });

  it('aramaya dokunmak arama alanını AÇAR — sadece ekrana götürmez', () => {
    expect(NAV).toContain("focusSearch: '1'");
    const tasks = read('app/tasks.tsx');
    expect(tasks).toContain("if (focusSearch === '1') setShowSearch(true);");
  });

  it('metni sözlükten — satır içi çeviri yok', () => {
    expect(NAV).toContain('t.nav.searchTasks');
    const { translations } = require('@/shared/constants/i18n');
    expect(translations.tr.nav.searchTasks).toBeTruthy();
    expect(translations.en.nav.searchTasks).toBeTruthy();
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
    expect(NAV).toMatch(/\{IS_IOS && <AppBlur material="chrome" \/>\}/);
  });

  it('ayraç çizgisi YALNIZ yapışık çubukta — yüzen kapsülde anlamsız', () => {
    expect(NAV).toMatch(/borderTopWidth: IS_IOS \? 0 : HAIRLINE/);
  });

  it('Android arama adasını ÇİZMEZ — altıncı bir hedef eklenmiyor', () => {
    /*
      Ada ÇİZİMİ iOS kapısının arkasında. Stil tanımı her iki platformda da dosyada
      durur — çizilmediği sürece zararsız; bu yüzden metne değil KAPIYA bakılıyor.
      Android'de arama bugünkü yerinde, Görevler ekranının içinde kalıyor.
    */
    const jsx = NAV.indexOf('style={[styles.searchIsland');
    expect(jsx).toBeGreaterThan(-1);
    expect(NAV.slice(Math.max(0, jsx - 300), jsx)).toContain('{IS_IOS && (');
  });
});
