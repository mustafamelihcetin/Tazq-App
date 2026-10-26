import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, Keyboard, useWindowDimensions, BackHandler } from 'react-native';
import { LayoutGrid, CheckSquare, Sparkles, Layers, CalendarDays } from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { swallow } from '@/shared/utils/swallow';
import { goHome } from '@/shared/utils/authNavigation';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { AppBlur } from '@/shared/components/AppBlur';
import { AndroidNavCapsule } from '@/shared/components/AndroidNavCapsule';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import {
  S, MAX_W, NAV_BAR_HEIGHT, NAV_BAR_MIN_INSET, NAV_ICON_SIZE, NAV_LABEL_SIZE,
  NAV_BAR_LIFT, NAV_BAR_SIDE_INSET, NAV_BAR_RADIUS,
  NAV_BAR_MINIMIZED_HEIGHT, NAV_CAPSULE_PAD, NAV_LABEL_MIN_TAB_WIDTH,
} from '@/shared/constants/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Touchable } from '@/shared/components/Touchable';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useSessionStore } from '@/shared/store/useSessionStore';
import { useChromeStore } from '@/shared/store/useChromeStore';
import { TourTarget } from '@/shared/components/TourContext';

/**
 * ALT SEKME ÇUBUĞU — iOS'ta yüzen cam kapsül, Android'de dibe yapışık çubuk.
 *
 * ── İKİ PLATFORM, İKİ DOĞRU ───────────────────────────────────────────────────
 * Bu bileşen bir süre TEK bir ölçüye göre kuruldu: UIKit'in Liquid Glass ÖNCESİ
 * UITabBar'ı (49pt içerik, dibe yapışık, tam genişlik, hairline ayraç). O ölçü
 * doğruydu ve Android'in Material gezinme çubuğuyla da uyumluydu — şanslı bir örtüşme.
 *
 * iOS 26 ile örtüşme bitti: sistem sekme çubuğu kenarlardan içeri alınmış, kapsül
 * biçimli, içeriğin ÜZERİNDE yüzen bir cam şerit oldu ve kaydırmada ikon-only'ye
 * küçülüyor. Android'de böyle bir şey yok ve olmamalı.
 *
 * Bu yüzden geometri `tokens.ts` içinde platforma göre ayrıldı.
 *
 * ANDROID (2026-10-24): M3 Expressive yüzen araç çubuğu — aynı kapsül biçimi, ama cam
 * değil TONAL opak yüzey + 3dp elevation; aktif sekme M3'ün 56×32 hap göstergesiyle
 * (react-bits PillNav gibi sekmeler arasında yayla kayar). Küçülme Android'de kapalı.
 * Kapsülün altı tema zeminine sönümlenir: tuşlu telefonda sistem tuşlarının zemini
 * sayfa içeriği değil tema rengi olur (çubuk kenardan kenara, saydam).
 *
 * ── ESKİ İTİRAZ VE NASIL ÇÖZÜLDÜĞÜ ────────────────────────────────────────────
 * Yüzen "pill" bir kez denenip geri alınmıştı; gerekçe kayıtlıydı ve haklıydı:
 *   1. Yuvarlak kabuk + içindeki kayan gösterge = üst üste binen iki form dili.
 *   2. 5 sekmeye düşen ~72pt'ye sekme ADI sığmıyordu.
 *
 * Apple'ın kendi çözümü ikisini de kaldırıyor:
 *   1. Aktif sekmenin tek işareti yine TİNT RENGİ — arkada kayan şekil yok. Kapsül
 *      kabuk, gösterge değil.
 *   2. ARAMA kapsülün içinde değil, sağında AYRI dairesel bir ada. Sekme satırının
 *      genişliğini yemiyor. Üstelik kaydırırken etiketler zaten kalkıyor — dar alan
 *      kalıcı bir durum değil, geçici bir hâl.
 *
 * Ölçüler ve gerekçeleri tokens.ts'te · Bkz. __tests__/floatingBars.test.ts
 */

// Lite modda ve misafirde gösterilecek sekmeler (sade to-do deneyimi).
const LITE_TAB_IDS = ['home', 'tasks', 'focus'];

/**
 * BARDA yazan KISA ad — sekme çubuğunda tek kelime konvansiyondur.
 *
 * ── İKİ TABLONUN DEĞERLERİ TERSTİ ─────────────────────────────────────────────
 * Bu tablo ile aşağıdaki `TAB_LABELS` bir noktada birbirine karışmış: BARDA yazan
 * ad "Derin Odak" ve "Yaşam Modları" (uzun), ekran okuyucuya okunan ad ise "Odak"
 * ve "Modlar" (kısa) idi — her iki yorumun da söylediğinin tam TERSİ.
 *
 * İkisi birden zarar veriyordu:
 *   · GÖRSEL: "Yaşam Modları" 13 karakter. 10pt'de ~68pt tutuyor ve bir sekmeye
 *     düşen alandan geniş — etiket kırpılıyor, çubuk sıkışık okunuyordu. Sıkışıklık
 *     bir yerleşim sorunu değil, yanlış tablodan gelen metindi.
 *   · SESLİ: ekran okuyucu kullanan kişi kısaltmayı duyuyordu. Oysa kısaltma bir
 *     yer darlığı çözümüdür; sesin yer sorunu yoktur ve kullanıcı özelliği
 *     onboarding'de duyduğu ADLA arar.
 */
const TAB_SHORT: Record<string, { tr: string; en: string }> = {
  home: { tr: 'Ana Sayfa', en: 'Home' },
  tasks: { tr: 'Görevler', en: 'Tasks' },
  focus: { tr: 'Odak', en: 'Focus' },
  cockpit: { tr: 'Haftalık', en: 'Weekly' },
  modlar: { tr: 'Modlar', en: 'Modes' },
};

/**
 * Ekran okuyucuya (VoiceOver/TalkBack) okunan TAM ad — kısaltma yalnız görsel.
 *
 * Sesli okunan ad, kullanıcının uygulamanın başka yerlerinde duyduğu adla AYNI
 * olmalı: "Derin Odak" odak ekranının kendi adı, "Yaşam Modları" da tanıtımda
 * geçen ad. Özelliği arayan kişi onu bu adla arar.
 */
const TAB_LABELS: Record<string, { tr: string; en: string }> = {
  home: { tr: 'Ana Sayfa', en: 'Home' },
  tasks: { tr: 'Görevler', en: 'Tasks' },
  focus: { tr: 'Derin Odak', en: 'Deep Focus' },
  cockpit: { tr: 'Haftalık Merkez', en: 'Weekly Hub' },
  modlar: { tr: 'Yaşam Modları', en: 'Life Modes' },
};

const IS_IOS = Platform.OS === 'ios';

const BottomNavBarInner = () => {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const { language, t } = useLanguageStore();
  const tr = language === 'tr';
  const uiMode = usePrefsStore(s => s.uiMode);
  const isGuest = useSessionStore(s => s.isGuest);

  /*
    ANDROID GERİ TUŞU — ana sayfa dışındaki sekmede önce EVE döner (Material: "geri, başlangıç
    hedefine"). Cihazda görüldü (2026-10-25): Görevler sekmesinde geri tuşu uygulamadan
    çıkıyordu; sekmeler `replace` ile değiştiği için yığında dönülecek ekran yok.
    Yalnız ODAKTAKİ ekranda kurulur (üstüne profil/ayarlar açılan ekranın çubuğu karışmaz);
    yığında gerçekten geri gidilecek bir ekran varsa olağan geri davranışı korunur.
  */
  /*
    useFocusEffect DEĞİL (2026-10-26, testçi çökmesi: e-posta doğrulamasından sonra
    "Rendered fewer hooks than expected" — BottomNavBar). useFocusEffect navigasyon bağlamına
    bağlı; doğrulama sonrası dismissTo('/') geçişinde bağlam ara durumdayken içeriden hata
    fırlatıp hook sayısını bozuyordu. Düz useEffect + pathname aynı işi bağlamsız yapar.
  */
  useEffect(() => {
    if (Platform.OS !== 'android' || pathname === '/') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) return false;
      goHome(router);
      return true;
    });
    return () => sub.remove();
  }, [pathname, router]);

  /*
    KÜÇÜLME YALNIZ iOS'TA. Android'de `minimized` okunuyor ama kullanılmıyor;
    sinyali üreten hook da zaten Android'de hiç çalışmıyor (bkz.
    useChromeMinimizeOnScroll). İki kapı da kapalı — biri unutulursa diğeri tutar.
  */
  const minimized = useChromeStore(s => s.minimized) && IS_IOS;

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  /*
    HOOK'LAR ERKEN DÖNÜŞTEN ÖNCE. `useWindowDimensions` eskiden aşağıdaki
    `return null`un ARKASINDAYDI: Android'de klavye açılınca bileşen daha az hook
    çağırıyor ve React "Rendered fewer hooks" hatasıyla düşüyordu (iOS'ta klavye
    dinlenmediği için hiç tetiklenmiyordu). Bkz. __tests__/androidParity.test.ts.
  */
  const { width: winW, fontScale } = useWindowDimensions();

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const allTabs = [
    { id: 'home', path: '/', icon: LayoutGrid },
    { id: 'tasks', path: '/tasks', icon: CheckSquare },
    { id: 'focus', path: '/focus', icon: Sparkles },
    { id: 'cockpit', path: '/cockpit', icon: CalendarDays },
    { id: 'modlar', path: '/modlar', icon: Layers },
  ];
  /*
    Sade modda ve misafirde sade sekme seti. Misafirde modlar sunucu gerektirdiği
    için gizli (bkz. __tests__/guestMode.test.ts); Sade modda oyunlaştırma ve modlar
    gizleniyor (bkz. __tests__/liteMode.test.ts).
  */
  const tabs = (uiMode === 'lite' || isGuest) ? allTabs.filter(t => LITE_TAB_IDS.includes(t.id)) : allTabs;

  const isActiveTab = (path: string) => pathname === path || (path === '/' && pathname === '/index');

  const handlePress = (path: string) => {
    if (pathname === path) return;
    router.replace(path as any);
  };

  if (keyboardVisible && Platform.OS === 'android') {
    return null;
  }

  const barHeight = minimized ? NAV_BAR_MINIMIZED_HEIGHT : NAV_BAR_HEIGHT;

  /*
    ── ETİKET SIĞIYOR MU? ───────────────────────────────────────────────────────

    Kırılım noktası (ör. "SE'de gizle") YAZMIYORUZ. Üç şey birden değişiyor:
    sekme SAYISI (Sade mod ve misafirde 3, Pro'da 5), ekran GENİŞLİĞİ ve yazı
    ÖLÇEĞİ (Dynamic Type). Sabit bir cihaz listesi üçünü de karşılamaz ve ilk yeni
    cihazda eskir. Gerçek soru soruluyor: bu sekmeye etiket sığıyor mu?

    `fontScale` çarpanı önemli: yazı büyüdükçe eşik de büyür. Yoksa erişilebilirlik
    için puntoyu büyüten kullanıcı kırpılmış etiketler görürdü — yani ayar ona
    zarar verirdi.

    Sığmıyorsa KIRPILMAZ, gizlenir: "Ana Say…" hem daha az bilgi taşır hem daha
    kalabalık durur. Apple da dar alanda etiketi düşürür.
  */
  const usableWidth = Math.min(winW, MAX_W) - NAV_BAR_SIDE_INSET * 2 - NAV_CAPSULE_PAD * 2;
  const perTabWidth = usableWidth / Math.max(tabs.length, 1);
  const labelFits = perTabWidth >= NAV_LABEL_MIN_TAB_WIDTH * Math.max(fontScale, 1);
  const showLabels = !minimized && labelFits;

  /** Kapsülün kabuk stili. */
  const shellStyle = {
    backgroundColor: 'transparent',
    borderRadius: NAV_BAR_RADIUS,
    overflow: 'hidden' as const,
  };


  return (
    <View
      style={[
        styles.container,
        {
          // Yüzen kapsülde alt boşluk güvenli alan + yükselti; Android'de yükselti 0
          // olduğu için davranış bugünküyle birebir aynı kalır.
          paddingBottom: Math.max(insets.bottom, NAV_BAR_MIN_INSET) + NAV_BAR_LIFT,
          paddingHorizontal: NAV_BAR_SIDE_INSET,
        },
      ]}
    >
      {/*
        ANDROID — ALTI TEMA ZEMİNİNE SÖNÜMLENİR. Sistem çubuğu saydam (kenardan kenara):
        tuşlu telefonda tuşların arkasında kayan sayfa içeriği görünüyordu. Kapsülün
        ortasından aşağısı tema zeminine geçiyor → tuşların zemini temanın rengi, içerik
        kapsülün altında yumuşakça kayboluyor (sert bir şerit değil).
      */}
      {!IS_IOS && (
        <LinearGradient
          pointerEvents="none"
          colors={[theme.background + '00', theme.background + 'F2', theme.background]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
      )}
      {/*
        Geniş/foldable ekranda sekmeler sonsuza yayılmasın — kapsül içerikle aynı
        sütunda kalır. Android de artık yüzen kapsül (M3 floating toolbar) olduğu için
        aynı kural iki platformda geçerli.
      */}
      <View style={styles.column}>
        <View style={styles.row}>

          {IS_IOS ? (
          <>
          {/* ── SEKME KAPSÜLÜ ────────────────────────────────────────────── */}
          <MotiView
            animate={{ height: barHeight }}
            transition={{ type: 'timing', duration: 220 }}
            style={[styles.capsule, shellStyle]}
          >
            {/* Yarıçap MALZEMEYE de veriliyor: yuvarlak kabın `overflow:hidden`i
                cam/blur katmanını güvenilir kırpmıyor (bkz. AppBlur radius notu). */}
            {IS_IOS && <AppBlur material="chrome" radius={NAV_BAR_RADIUS} />}
            <View style={styles.tabsContainer} accessibilityRole="tablist">
              {tabs.map((tab) => {
                const isActive = isActiveTab(tab.path);
                const Icon = tab.icon;

                const content = (
                  // Aktif durum TEK sinyalle: TINT RENGİ — ikon ve etiket birlikte boyanır.
                  // UIKit'in UITabBar'ı tam olarak bunu yapar; arkada şekil gezdirmez,
                  // ikonu büyütmez, yazıyı kalınlaştırmaz. Tek değişken renktir.
                  //
                  // Tek uyarlama: SF Symbols seçiliyken dolu (.fill) varyanta geçer, bizim
                  // ikon setimiz (lucide) çizgisel. Doluya geçirmek CalendarDays gibi
                  // glifleri lekeye çeviriyor; onun yerine çizgi kalınlığı bir tık artıyor.
                  // Aynı ikon, biraz daha "orada" — farklı bir ikon değil.
                  <View style={styles.tabInner}>
                    <Icon
                      // ÖLÇEKLENMEZ: çubuk yüksekliği sabit olduğu için içerik de sabit
                      // olmalı. Ölçekli ikon büyük ekranda kabı taşırıyordu (bkz. tokens).
                      size={NAV_ICON_SIZE}
                      color={isActive ? theme.primary : theme.onSurfaceVariant}
                      strokeWidth={isActive ? 2.1 : 1.8}
                    />
                    {/* Etiket iki durumda gizlenir: çubuk küçüldüğünde (Apple'ın
                        ikon-only pill'i) ve sığmadığında. İkisinde de İKON yerinde
                        kalır — dokunma hedefi kaymaz. */}
                    {showLabels && (
                      <Text
                        numberOfLines={1}
                        // Sekme adı ekran okuyucuya accessibilityLabel ile TAM hâliyle
                        // veriliyor; buradaki kısa metin ikinci kez duyurulmasın.
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                        style={[styles.tabLabel, { color: isActive ? theme.primary : theme.onSurfaceVariant }]}
                      >
                        {tr ? TAB_SHORT[tab.id].tr : TAB_SHORT[tab.id].en}
                      </Text>
                    )}
                  </View>
                );

                return (
                  <Touchable
                    key={tab.id}
                    onPress={() => handlePress(tab.path)}
                    activeOpacity={0.7}
                    style={styles.tab}
                    accessibilityRole="tab"
                    accessibilityLabel={tr ? TAB_LABELS[tab.id].tr : TAB_LABELS[tab.id].en}
                    accessibilityState={{ selected: isActive }}
                  >
                    {tab.id === 'focus' ? (
                      <TourTarget id="focus" style={{ alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                        {content}
                      </TourTarget>
                    ) : (
                      content
                    )}
                  </Touchable>
                );
              })}
            </View>
          </MotiView>
          </>
          ) : (
            /* ── ANDROID: iOS çubuğunun kardeşi — opak yüzey + nötr seçim vurgusu (bkz. AndroidNavCapsule) */
            <View style={{ flex: 1 }}>
              <AndroidNavCapsule
                theme={theme}
                isDark={isDark}
                // iOS ile AYNI kural: her sekmenin altında ad, sığmıyorsa yalnız ikon.
                showLabels={labelFits}
                tabs={tabs.map((tab) => ({
                  id: tab.id,
                  Icon: tab.icon,
                  label: tr ? TAB_SHORT[tab.id].tr : TAB_SHORT[tab.id].en,
                  a11yLabel: tr ? TAB_LABELS[tab.id].tr : TAB_LABELS[tab.id].en,
                  isActive: isActiveTab(tab.path),
                  onPress: () => handlePress(tab.path),
                }))}
              />
            </View>
          )}

        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  column: {
    width: '100%',
    maxWidth: MAX_W,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  capsule: {
    flex: 1,
    justifyContent: 'center',
    // Yuvarlak uçlu kapta içerik kenara dayanmaz; ilk ve son sekme eğrinin
    // dibinde durmasın diye küçük bir iç pay.
    paddingHorizontal: NAV_CAPSULE_PAD,
  },
  tabsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    // Dokunma hedefi sekmenin TAM boyu — üst/alt ölü alan bırakılmaz.
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    // Apple'ın ikon–etiket aralığı ~2pt; yığın çubukta dikey ortalanır.
    gap: S.xxs,
  },
  tabLabel: {
    fontSize: NAV_LABEL_SIZE,
    fontWeight: '600',
    // Sekme etiketinde harf aralığı AÇILMAZ — Apple açmaz ve 10pt'de açmak
    // kelimeyi dağıtır.
    letterSpacing: 0,
  },
});

/*
  ALT MENÜNÜN KENDİ HATA SINIRI — menüde bir hata bütün uygulamayı "Bir şeyler ters gitti"
  ekranına düşürmesin (testçi çökmesi, 2026-10-26). Hata olursa menü bir kare gizlenir,
  raporlanır ve yeniden kurulur.
*/
class NavBarBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) {
    swallow('BottomNavBar.render', e, { capture: true });
    setTimeout(() => this.setState({ failed: false }), 0);
  }
  render() { return this.state.failed ? null : this.props.children; }
}

export const BottomNavBar = () => (
  <NavBarBoundary>
    <BottomNavBarInner />
  </NavBarBoundary>
);
