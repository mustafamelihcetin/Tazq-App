import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, Keyboard } from 'react-native';
import { LayoutGrid, CheckSquare, Sparkles, Layers, CalendarDays } from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { AppBlur } from '@/shared/components/AppBlur';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { S, HAIRLINE, MAX_W, NAV_BAR_HEIGHT, NAV_BAR_MIN_INSET, NAV_ICON_SIZE, NAV_LABEL_SIZE } from '@/shared/constants/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Touchable } from '@/shared/components/Touchable';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { TourTarget } from '@/shared/components/TourContext';
import { haptic } from '@/shared/utils/haptics';

/**
 * Alt sekme çubuğu — ekranın dibine yapışık, TAM GENİŞLİKTE, standart desen.
 *
 * NEDEN YÜZEN "PILL" DEĞİL: önceki hâl %92 genişlikte, tam yuvarlak, 68pt yüksekliğinde
 * yüzen bir kabuktu ve aktif sekmenin arkasında kayan bir hap/daire taşıyordu. İki
 * sorun birden üretiyordu:
 *   1. Yuvarlak kabuk + içindeki ayrı şekil = üst üste binen iki form dili, görsel yük.
 *   2. Beş sekmeye ~72pt düşüyordu; sekme ADI oraya sığmıyordu. Sonuç ya isimsiz bar
 *      (ikon-only: "Layers" ne demek? "Sparkles" ne demek?) ya da sıkışık, ucuz duran
 *      etiketler oluyordu. İkisi de denendi, ikisi de tutmadı.
 *
 * ÖLÇÜLER APPLE'IN SPESİFİKASYONU (UIKit UITabBar):
 *   · içerik yüksekliği 49pt, güvenli alan ALTINA eklenir (iPhone'da toplam 83pt)
 *   · etiket 10pt / semibold, harf aralığı açılmaz
 *   · ikon 22pt (lucide çizgisel set SF Symbols'ten optik ağır; 22 denk düşüyor)
 *   · yükseklik, ikon ve etiket ÖLÇEKLENMEZ — sekme çubuğu içerik değil chrome'dur
 *   · aktif sekmenin TEK işareti tint rengi — arkada şekil, büyüme, kalınlaşma yok
 *   · yarı saydam zemin (blur) + üstte tek hairline ayraç
 *
 * Geometri tokens.ts'te (NAV_BAR_HEIGHT / navBarSpace) — sayfalar alt boşluğu oradan
 * türetir, bu bileşen de stilini oradan kurar. Bkz. __tests__/floatingBars.test.ts
 */

// Lite modda gösterilecek sekmeler (sade to-do deneyimi). Pro'da hepsi görünür.
const LITE_TAB_IDS = ['home', 'tasks', 'focus'];

/**
 * BARDA yazan kısa ad. Sekme çubuğunda tek kelime konvansiyondur; tam genişlikte
 * bile "Haftalık Merkez" iki satıra düşer.
 */
const TAB_SHORT: Record<string, { tr: string; en: string }> = {
  home: { tr: 'Ana Sayfa', en: 'Home' },
  tasks: { tr: 'Görevler', en: 'Tasks' },
  focus: { tr: 'Odak', en: 'Focus' },
  cockpit: { tr: 'Haftalık', en: 'Weekly' },
  modlar: { tr: 'Modlar', en: 'Modes' },
};

// Ekran okuyucu (VoiceOver/TalkBack) için TAM sekme adı — kısaltma yalnız görsel.
const TAB_LABELS: Record<string, { tr: string; en: string }> = {
  home: { tr: 'Ana Sayfa', en: 'Home' },
  tasks: { tr: 'Görevler', en: 'Tasks' },
  focus: { tr: 'Odak', en: 'Focus' },
  cockpit: { tr: 'Haftalık Merkez', en: 'Weekly Hub' },
  modlar: { tr: 'Modlar', en: 'Modes' },
};

export const BottomNavBar = () => {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const { language } = useLanguageStore();
  const tr = language === 'tr';
  const uiMode = usePrefsStore(s => s.uiMode);

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
  // Lite modda sade sekme seti; Pro'da hepsi.
  const tabs = uiMode === 'lite' ? allTabs.filter(t => LITE_TAB_IDS.includes(t.id)) : allTabs;

  const handlePress = (path: string) => {
    if (pathname === path) return;
    router.replace(path as any);
  };

  if (keyboardVisible && Platform.OS === 'android') {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        {
          // Dibe yapışık: güvenli alan çubuğun ALTINA eklenir, içerik home
          // göstergesinin üstünde kalır.
          paddingBottom: Math.max(insets.bottom, NAV_BAR_MIN_INSET),
          // iOS'ta sekme çubuğu yarı saydamdır (içerik altından geçerken belli olur);
          // zemini BlurView verir. Android'de blur zayıf → opak yüzey.
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : theme.surfaceFloating,
          borderTopColor: theme.outlineVariant,
        },
      ]}
    >
      {Platform.OS === 'ios' && (
        <AppBlur material="chrome" />
      )}
      {/* Geniş/foldable ekranda sekmeler sonsuza yayılmasın — içerikle aynı sütun. */}
      <View style={styles.column}>
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
                  // ÖLÇEKLENMEZ: çubuk yüksekliği sabit 49 olduğu için içerik de sabit
                  // olmalı. Ölçekli ikon büyük ekranda kabı taşırıyordu (bkz. tokens).
                  size={NAV_ICON_SIZE}
                  color={isActive ? theme.primary : theme.onSurfaceVariant}
                  strokeWidth={isActive ? 2.1 : 1.8}
                />
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
    // Tek ince çizgi: çubuğun nerede başladığını söyler. Yüzen kabuğun gölgesi ve
    // çerçevesi yerine iOS'un standart ayracı.
    borderTopWidth: HAIRLINE,
  },
  column: {
    width: '100%',
    maxWidth: MAX_W,
    alignSelf: 'center',
  },
  tabsContainer: {
    height: NAV_BAR_HEIGHT,
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
    // Apple'ın ikon–etiket aralığı ~2pt; yığın 49pt'lik çubukta dikey ortalanır.
    gap: S.xxs,
  },
  tabLabel: {
    // Apple sekme etiketi: 10pt / semibold, ÖLÇEKLENMEZ (bkz. NAV_LABEL_SIZE).
    fontSize: NAV_LABEL_SIZE,
    fontWeight: '600',
    // UIKit sekme etiketinde harf aralığı AÇILMAZ; 10pt'de açmak kelimeyi dağıtır.
    letterSpacing: 0,
  },
});
