import fs from 'fs';
import path from 'path';

/**
 * ANDROID EŞİTLİĞİ — iOS'ta görünmeyen, yalnız Android'de çıkan kusurlar.
 *
 * Kullanıcı Android'de denediğinde bildirdi (2026-10-24); her madde kodda kök nedenine
 * kadar izlendi. Bu dosya o kök nedenlerin geri gelmesini engeller. Hiçbiri iOS'un
 * davranışını değiştirmez: elevation ve blurMethod iOS'ta yok sayılan özellikler.
 */

const ROOT = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

/** `elevation: N` değerlerinin en büyüğü (yorumlar hariç). */
const maxElevation = (rel: string) =>
  Math.max(0, ...[...stripComments(read(rel)).matchAll(/elevation:\s*(\d+)/g)].map((m) => Number(m[1])));

describe('tur katmanı Android\'de öne çıkan düğmelerin ÜSTÜNDE', () => {
  /*
    Tur ekranın içinde çizilir (Modal değil) ve zIndex 9990 ile öne alınır. Android çizim
    sırasını önce ELEVATION'a göre kurar; zIndex yalnız eşit Z'de sıra belirler. Kayan
    düğmenin elevation'ı 10 iken turun kökünde elevation yoktu → düğme turun üstünde
    kalıyordu. iOS elevation'ı tanımaz; orada hiç görünmüyordu.
  */
  // 2026-10-25: tur yeniden kuruldu — katman artık SpotlightTour (vurgulama) ve
  // TourBeacon (teklif balonu). İkisi de ekran içinde çizilir; kural aynen geçerli.
  it.each([
    ['features/onboarding/components/SpotlightTour.tsx', 'root'],
    ['features/onboarding/components/TourBeacon.tsx', 'wrap'],
  ])('%s kökünün elevation\'ı kayan düğmelerinkinden büyük', (file, key) => {
    const src = stripComments(read(file));
    const root = src.match(new RegExp(`${key}: \\{([^}]*)\\}`))?.[1] ?? '';
    const rootElevation = Number(root.match(/elevation:\s*(\d+)/)?.[1] ?? 0);
    const fabs = Math.max(maxElevation('shared/components/MagneticFAB.tsx'), maxElevation('app/tasks.tsx'), maxElevation('app/index.tsx'));
    expect(rootElevation).toBeGreaterThan(fabs);
  });
});

describe('AppBlur Android\'de blurTarget olmadan gerçek blur İSTEMEZ', () => {
  /*
    expo-blur 56'da dimezis blur bir `blurTarget` (BlurTargetView) ister; yoksa native
    taraf zaten "none"a düşer ve her çizimde konsola uyarı basar. Projede BlurTargetView
    yok → istenen blur hiç çizilmiyordu, yalnız uyarı üretiyordu. 'none' vermek GÖRÜNÜMÜ
    DEĞİŞTİRMEZ (aynı yarı saydam yüzey), yalnız yanlış vaadi ve uyarıyı kaldırır.
  */
  it('projede BlurTargetView yoksa dimezis yöntemi verilmez', () => {
    const usesTarget = ['app', 'shared', 'features'].some((d) =>
      fs.readdirSync(path.join(ROOT, d), { recursive: true } as any)
        .some((f: any) => String(f).endsWith('.tsx') && /<BlurTargetView/.test(stripComments(read(`${d}/${f}`)))),
    );
    if (usesTarget) return;
    expect(stripComments(read('shared/components/AppBlur.tsx'))).not.toMatch(/blurMethod=\{[^}]*dimezis/);
  });
});

describe('bildirim modülü yoksa kök düzen çökmez', () => {
  /*
    Expo Go (Android) expo-notifications'ı yükleyemiyor; `require` ikinci kez undefined
    döndü ve `Notifs.getLastNotificationResponseAsync` TypeError fırlattı. Yutuluyordu
    ama bildirim dinleyicisi de hiç kurulmuyordu. Modül yoksa akış sessizce atlanmalı.
  */
  it('Notifs yoksa erken çıkılır', () => {
    const src = stripComments(read('app/_layout.tsx'));
    expect(src).toMatch(/const Notifs = require\('expo-notifications'\);\s*if \(!Notifs\) return;/);
  });
});

describe('dil deposu ↔ görev modülü döngüsel import yok', () => {
  /*
    useLanguageStore → systemTaskTranslator → features/tasks (barrel) → QuickAddSheet →
    nlpChips → useLanguageStore. Metro "uninitialized values" uyarısı veriyordu: barrel
    tüm görev bileşenlerini dil deposundan ÖNCE yüklemeye çalışıyor. Çevirmen yalnız
    `translateTag`e ihtiyaç duyuyor; onu doğrudan kaynağından almak döngüyü kırar.
  */
  it('systemTaskTranslator görev barrel\'ından import etmez', () => {
    const src = read('features/tasks/utils/systemTaskTranslator.ts');
    expect(src).not.toMatch(/from '@\/features\/tasks';/);
  });
});

describe('Android alt tuş çubuğu temayı izler', () => {
  /*
    expo-navigation-bar 56'da `setBackgroundColorAsync` / `setButtonStyleAsync` YOK
    (kenardan kenara zorunlu; çubuk saydam). Kod `if (NavigationBar.setBackgroundColorAsync)`
    ile korunuyordu → koşul hep yanlış, çubuk HİÇ temaya uymuyordu. Yeni API `setStyle`:
    'light' = açık çubuk + koyu simge, 'dark' = koyu çubuk + açık simge (eskisinin tersi).
  */
  it('kaldırılmış API çağrılmaz, setStyle tema ile çağrılır', () => {
    const src = stripComments(read('app/_layout.tsx'));
    expect(src).not.toMatch(/NavigationBar\.(setBackgroundColorAsync|setButtonStyleAsync)/);
    expect(src).toMatch(/NavigationBar\??\.setStyle\??\.?\(/);
    expect(src).toMatch(/safeNavigationBar\(isDark \? 'dark' : 'light'\)/);
  });

  /*
    Sekme çubuğunun kabı Android'de saydamdı: tuş çubuğunun arkasına (insets.bottom)
    sayfa içeriği kayıyordu — tuşların zemini temadan değil içerikten geliyordu.
    Yüzen kapsülün altı artık tema zeminine sönümlenir.
  */
  it('sekme çubuğunun altı Android\'de tema zeminine sönümlenir', () => {
    const src = stripComments(read('shared/components/BottomNavBar.tsx'));
    expect(src).toMatch(/!IS_IOS && \(\s*<LinearGradient[\s\S]*?theme\.background\]/);
  });
});

describe('sekme çubuğu: hook\'lar erken dönüşten ÖNCE', () => {
  /*
    `useWindowDimensions` `return null`un ARKASINDAYDI. Android'de klavye açılınca
    (yalnız orada dinleniyor) bileşen daha az hook çağırıyor → React "Rendered fewer
    hooks than expected" ile düşüyordu. iOS'ta hiç tetiklenmediği için görünmedi.
  */
  it('BottomNavBar\'da ilk return null\'dan sonra hook çağrılmaz', () => {
    const src = stripComments(read('shared/components/BottomNavBar.tsx'));
    const body = src.slice(src.indexOf('export const BottomNavBar'));
    const afterReturn = body.slice(body.indexOf('return null;'));
    const end = afterReturn.indexOf('\n  return (');
    expect(afterReturn.slice(0, end)).not.toMatch(/\buse[A-Z]\w*\(/);
  });
});

describe('zayıf Android cihazda aurora her karede çizilmez', () => {
  /*
    Cihazda ölçüldü (Huawei Y6 2019, PowerVR GPU, yalnız 32-bit): Skia her karede
    SurfaceTexture.updateTexImage çağırıyor, sürücü reddediyor → saniyede 25 hata
    (Skia kendi kodunda "can safely be ignored" diyor ama her kare bir istisna nesnesi
    ve zayıf işlemciyi yoruyor). Çözüm kütüphaneye dokunmak değil: zayıf cihazda aurora
    DURAKLATILIR (tek kare çizilir, saat okunmaz). Sınıflama: Facebook device-year-class.
  */
  const { isLowPowerGraphics } = require('@/shared/hooks/useLowPowerGraphics');

  it('iOS asla düşük güç sayılmaz — iOS davranışı değişmez', () => {
    expect(isLowPowerGraphics({ os: 'ios', yearClass: 2012, totalMemory: 1e9 })).toBe(false);
  });

  it('eski yıl sınıfı Android → düşük güç', () => {
    expect(isLowPowerGraphics({ os: 'android', yearClass: 2014, totalMemory: 2e9 })).toBe(true);
  });

  it('güncel Android → tam efekt', () => {
    expect(isLowPowerGraphics({ os: 'android', yearClass: 2020, totalMemory: 8e9 })).toBe(false);
  });

  it('yıl sınıfı bilinmiyorsa RAM\'e bakılır (3 GB altı düşük)', () => {
    expect(isLowPowerGraphics({ os: 'android', yearClass: null, totalMemory: 2e9 })).toBe(true);
    expect(isLowPowerGraphics({ os: 'android', yearClass: null, totalMemory: 6e9 })).toBe(false);
    expect(isLowPowerGraphics({ os: 'android', yearClass: null, totalMemory: null })).toBe(false);
  });

  it('Odak ekranındaki iki aurora da düşük güçte duraklar', () => {
    const src = stripComments(read('app/focus.tsx'));
    const nebulas = [...src.matchAll(/<Nebula[\s\S]*?paused=\{([^\n]*)\}/g)].map((m) => m[1]);
    expect(nebulas).toHaveLength(2);
    for (const p of nebulas) expect(p).toContain('lowPowerGraphics');
  });
});

describe('tanıtım başlığı Android\'de kelimeleri bitiştirmez', () => {
  /*
    Cihazda görüldü: "DerinOdak", "AkıllıGörev". Başlık 44pt Jakarta ExtraBold,
    letterSpacing -2.5 (≈ -0.057em; M3 Display -0.25sp ≈ -0.004em). Android'in metin
    motoru aralığı boşluk glifine de uyguluyor → kelime arası kapanıyor. Android
    projenin optik ölçeğine (trackingFor) geçer; iOS'ta -2.5 aynen kalır.
  */
  it('başlık harf aralığı platforma göre — Android trackingFor', () => {
    const src = stripComments(read('app/onboarding.tsx'));
    expect(src).toMatch(/title: \{ fontFamily: 'Jakarta-ExtraBold', textAlign: 'center' \}/);
    expect(src).toMatch(/letterSpacing: Platform\.OS === 'ios' \? -2\.5 : trackingFor\(/);
  });
});

describe('tur balonu sekme çubuğuyla çakışmaz', () => {
  /*
    Cihazda görüldü (eski tur): "Atla"/"Sonraki" sekme çubuğunun tam hizasındaydı.
    Yeni turda balonun görünür bandı sekme çubuğunun GERÇEK yüksekliğinden türer.
  */
  it('balon bandının altı navBarSpace', () => {
    const src = stripComments(read('features/onboarding/components/SpotlightTour.tsx'));
    expect(src).toMatch(/bottom: navBarSpace\(insets\.bottom\)/);
    // Balon: sekme çubuğu olan sayfada onun üstünde; Odak'ta (çubuk yok) ekranın dibinde —
    // eskiden Odak'ta ses satırının üstüne biniyordu (cihazda görüldü).
    expect(stripComments(read('features/onboarding/components/TourBeacon.tsx'))).toMatch(/bottom: \(aboveTabBar \? navBarSpace\(insets\.bottom\) : insets\.bottom\) \+ S\.md/);
    expect(read('features/onboarding/components/HelpTourModal.tsx')).toContain("aboveTabBar={pageId !== 'focus'}");
  });
});

describe('tur karartması Android\'de blur eksiğini telafi eder', () => {
  /*
    Android'de blur yok (bkz. AppBlur): arkadaki yazılar keskin kalıyor. Vurgulamalı
    turda örtü düz renk; Android'de bir kademe koyu.
  */
  it('örtü platforma göre — Android daha koyu', () => {
    const src = stripComments(read('features/onboarding/components/SpotlightTour.tsx'));
    expect(src).toMatch(/const scrim = IS_IOS \? 'rgba\(0,0,0,0\.55\)' : 'rgba\(0,0,0,0\.66\)'/);
  });
});

describe('canlandırılan SVG özelliği React\'e de son değeriyle verilir', () => {
  /*
    Cihazda görüldü (2026-10-25): tur sırasında Bugün halkaları 1/3 ve 36/60 derken
    yaylar BOŞ çiziliyordu. Yay `animatedProps` ile UI iş parçacığında çiziliyor; animasyon
    bitince ana sayfa yeniden çizilirse (tur, örnek veri) React'in elindeki statik değer —
    ilk hâl, yani boş halka — uygulanıyor ve UI iş parçacığı bir daha dokunmuyor.
    Kural: animatedProps ile canlandırılan her SVG özelliği statik olarak da SON değeriyle
    verilir; yeniden çizim doğru değeri taşır.
  */
  // Halkalar animatedProps KULLANMAZ — değer JS'te ilerler (useTween); statik değer
  // vermek de cihazda yetmedi. Vurgulama deliği animatedProps'ta kalır (yeniden çizimde
  // doğru göründüğü cihazda ölçüldü) ve son değeri statik de taşır.
  it.each(['features/dashboard/components/TodayRings.tsx', 'shared/components/SubtaskProgressRing.tsx'])('%s animatedProps kullanmaz, useTween kullanır', (file) => {
    const src = stripComments(read(file));
    expect(src).not.toContain('animatedProps');
    expect(src).toContain('useTween(');
  });
  it('vurgulama deliği son değeri statik de taşır', () => {
    const src = stripComments(read('features/onboarding/components/SpotlightTour.tsx'));
    const tag = src.slice(src.indexOf('<AnimatedPath'), src.indexOf('/>', src.indexOf('<AnimatedPath')));
    expect(tag).toMatch(/\sd=\{/);
    expect(tag).toContain('animatedProps={animatedProps}');
  });
});

describe('sağlık kaynağının adı platforma göre', () => {
  /*
    Cihazda görüldü: Android profilinde "Uyku & Sağlık — Apple Sağlık, uyku hedefi".
    Android'de kaynak Health Connect (bkz. shared/services/sleepHealth.ts). Ad tek
    yerden gelir; ekranlar sabit "Apple Sağlık" yazmaz.
  */
  it('profil ve ayarlar sabit "Apple Sağlık" yazmaz', () => {
    for (const f of ['app/profile.tsx', 'app/settings.tsx']) {
      expect({ f, hard: /'Apple (Sağlık|Health)/.test(stripComments(read(f))) }).toEqual({ f, hard: false });
    }
  });
  it('yardımcı Android\'de Health Connect der', () => {
    const src = read('shared/utils/healthSource.ts');
    expect(src).toMatch(/Platform\.OS === 'android' \? 'Health Connect'/);
  });
});
