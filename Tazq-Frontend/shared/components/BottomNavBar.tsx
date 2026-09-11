import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, Keyboard } from 'react-native';
import { LayoutGrid, CheckSquare, Sparkles, Layers, CalendarDays, Search } from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { MotiView } from 'moti';
import { AppBlur } from '@/shared/components/AppBlur';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import {
  S, HAIRLINE, MAX_W, NAV_BAR_HEIGHT, NAV_BAR_MIN_INSET, NAV_ICON_SIZE, NAV_LABEL_SIZE,
  NAV_BAR_LIFT, NAV_BAR_SIDE_INSET, NAV_BAR_RADIUS, NAV_SEARCH_SIZE, NAV_ISLAND_GAP,
  NAV_BAR_MINIMIZED_HEIGHT,
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
 * Bu yüzden geometri `tokens.ts` içinde platforma göre ayrıldı. Android bu turda
 * GÖRSEL OLARAK HİÇ DEĞİŞMİYOR: yükselti 0, yan boşluk 0, yarıçap 0, küçülme kapalı.
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
 * BARDA yazan kısa ad. Sekme çubuğunda tek kelime konvansiyondur; tam genişlikte
 * bile "Haftalık Merkez" iki satıra düşer.
 */
const TAB_SHORT: Record<string, { tr: string; en: string }> = {
  home: { tr: 'Ana Sayfa', en: 'Home' },
  tasks: { tr: 'Görevler', en: 'Tasks' },
  // "Odak" tek basina ne yaptigini soylemiyordu; uygulamanin kendi dilinde adi
  // "Derin Odak" (bkz. focus ekrani). Gorsel etiket "Odak" kaliyor.
  focus: { tr: 'Derin Odak', en: 'Deep Focus' },
  cockpit: { tr: 'Haftalık', en: 'Weekly' },
  // TAM ad — ekran okuyucuya bu okunur. Gorsel etiket kisa kaliyor ("Modlar"),
  // cunku sekme etiketleri kisaltmadir. Ama sesli okunan ad, kullanicinin onboarding'de
  // duydugu adla AYNI olmali; yoksa ozelligi arayan kisi bulamaz.
  modlar: { tr: 'Yaşam Modları', en: 'Life Modes' },
};

// Ekran okuyucu (VoiceOver/TalkBack) için TAM sekme adı — kısaltma yalnız görsel.
const TAB_LABELS: Record<string, { tr: string; en: string }> = {
  home: { tr: 'Ana Sayfa', en: 'Home' },
  tasks: { tr: 'Görevler', en: 'Tasks' },
  focus: { tr: 'Odak', en: 'Focus' },
  cockpit: { tr: 'Haftalık Merkez', en: 'Weekly Hub' },
  modlar: { tr: 'Modlar', en: 'Modes' },
};

const IS_IOS = Platform.OS === 'ios';

export const BottomNavBar = () => {
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
    KÜÇÜLME YALNIZ iOS'TA. Android'de `minimized` okunuyor ama kullanılmıyor;
    sinyali üreten hook da zaten Android'de hiç çalışmıyor (bkz.
    useChromeMinimizeOnScroll). İki kapı da kapalı — biri unutulursa diğeri tutar.
  */
  const minimized = useChromeStore(s => s.minimized) && IS_IOS;

  const [keyboardVisible, setKeyboardVisible] = useState(false);

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

  const handlePress = (path: string) => {
    if (pathname === path) return;
    router.replace(path as any);
  };

  if (keyboardVisible && Platform.OS === 'android') {
    return null;
  }

  const barHeight = minimized ? NAV_BAR_MINIMIZED_HEIGHT : NAV_BAR_HEIGHT;
  const searchActive = pathname === '/tasks';

  /** Kapsül ve arama adasının ortak kabuk stili. */
  const shellStyle = {
    backgroundColor: IS_IOS ? 'transparent' : theme.surfaceFloating,
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
          // Ayraç çizgisi YALNIZ dibe yapışık çubukta anlamlı. Yüzen kapsülde
          // çizginin bağlanacağı bir kenar yok; kabuğun kendisi sınırı söylüyor.
          borderTopWidth: IS_IOS ? 0 : HAIRLINE,
          borderTopColor: theme.outlineVariant,
        },
      ]}
    >
      {/* Geniş/foldable ekranda sekmeler sonsuza yayılmasın — içerikle aynı sütun. */}
      <View style={styles.column}>
        <View style={styles.row}>

          {/* ── SEKME KAPSÜLÜ ────────────────────────────────────────────── */}
          <MotiView
            animate={{ height: barHeight }}
            transition={{ type: 'timing', duration: 220 }}
            style={[styles.capsule, shellStyle]}
          >
            {IS_IOS && <AppBlur material="chrome" />}
            <View style={styles.tabsContainer} accessibilityRole="tablist">
              {tabs.map((tab) => {
                const isActive = pathname === tab.path || (tab.path === '/' && pathname === '/index');
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
                    {/* Küçülmüş hâlde etiket YOK — Apple'ın ikon-only pill'i.
                        Etiket kaldırılıyor, ikon yerinde kalıyor: hedef kaymaz. */}
                    {!minimized && (
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

          {/* ── ARAMA ADASI ──────────────────────────────────────────────────
              Apple'ın deseni: arama diğer sekmelerden GÖRSEL OLARAK ayrılır ve
              kendi dairesel cam adasında durur. Bu yalnız estetik değil — aramayı
              sekme satırından çıkararak kalan 5 sekmeye genişlik bırakıyor; eski
              "yüzen pill"in çöktüğü nokta tam olarak burasıydı.

              ANDROID'DE YOK: Material'ın gezinme çubuğunda ayrık ada diye bir şey
              yok ve altıncı bir hedef eklemek çubuğu kalabalıklaştırırdı. Android'de
              arama bugünkü yerinde — Görevler ekranının içinde — kalıyor. */}
          {IS_IOS && (
            <MotiView
              animate={{ height: barHeight, width: barHeight }}
              transition={{ type: 'timing', duration: 220 }}
              style={[styles.searchIsland, shellStyle, { borderRadius: NAV_BAR_RADIUS }]}
            >
              <AppBlur material="chrome" />
              <Touchable
                // Titreşim YOK: bu saf gezinme, bir işlem sonucu değil.
                onPress={() => router.replace({ pathname: '/tasks', params: { focusSearch: '1' } } as any)}
                activeOpacity={0.7}
                style={styles.searchTouch}
                accessibilityRole="button"
                accessibilityLabel={t.nav.searchTasks}
                accessibilityState={{ selected: searchActive }}
              >
                <Search
                  size={NAV_ICON_SIZE}
                  color={searchActive ? theme.primary : theme.onSurfaceVariant}
                  strokeWidth={searchActive ? 2.1 : 1.8}
                />
              </Touchable>
            </MotiView>
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
    gap: NAV_ISLAND_GAP,
  },
  capsule: {
    flex: 1,
    justifyContent: 'center',
  },
  searchIsland: {
    width: NAV_SEARCH_SIZE,
    height: NAV_SEARCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchTouch: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
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
