import React, { useState, useRef } from 'react';
import { F, S, ICON, R, trackingFor } from '@/shared/constants/tokens';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { ChevronRight } from 'lucide-react-native';
import { OnboardingVisual } from '@/features/onboarding/components/OnboardingVisuals';
import { Touchable } from '@/shared/components/Touchable';
import { track } from '@/shared/utils/analytics';
import { usePrefsStore } from '@/features/modes';
import { useAuthStore } from '@/features/user';
import { swallow } from '@/shared/utils/swallow';
import { haptic } from '@/shared/utils/haptics';
import { goHome } from '@/shared/utils/authNavigation';

/**
 * TANITIM — YEDİ SLAYTTAN DÖRDE.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Yedi slayt "Geç"e basılmasını garanti ediyordu; basıldığında da hiçbir şey
 * anlatılmamış oluyordu. Uzunluk anlatımı güçlendirmiyor, ZAYIFLATIYOR: kullanıcı
 * daha uygulamayı görmeden yedi ekran okumak istemiyor.
 *
 * ── HANGİSİ NEDEN DÜŞTÜ ───────────────────────────────────────────────────────
 *  · gizlilik → aynı bilgi kayıt ekranında zaten var (ve orada bağlamı var)
 *  · haftalık merkez → ikinci seviye bir ekran; ilk dakikanın konusu değil
 *  · ivme skoru → Sade modda o özellik YOK; herkese anlatmak yanlış vaat
 *
 * ── KALANLARIN SIRASI ─────────────────────────────────────────────────────────
 * hoş geldin · akıllı giriş · YAŞAM MODLARI · odak
 *
 * Modlar üçüncü sıraya alındı: uygulamanın gerçek farkı o. Dördüncü slayta kadar
 * gelmeyen kullanıcı bile uygulamanın ne yaptığını anlamış oluyor.
 */
const SLIDES: { id: string; titleKey: string; bodyKey: string; type: 'today' | 'smart' | 'modes' | 'focus' }[] = [
  {
    id: '1',
    titleKey: 'onboardingTitle1',
    bodyKey: 'onboardingBody1',
    type: 'today',
  },
  {
    id: '2',
    titleKey: 'onboardingTitle2b',
    bodyKey: 'onboardingBody2b',
    type: 'smart',
  },
  {
    id: 'modes',
    titleKey: 'onboardingTitleModes',
    bodyKey: 'onboardingBodyModes',
    type: 'modes',
  },
  {
    id: '3',
    titleKey: 'onboardingTitle3',
    bodyKey: 'onboardingBody3b',
    type: 'focus',
  },
];

export default function OnboardingScreen() {
  const { theme, isDark } = useAppTheme();
  const { t, language } = useLanguageStore();
  const tr = language === 'tr';
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  /*
    MOD SORUSU KALKTI (2026-11-06): uygulamayı hiç görmemiş birine "skor mu sade mi" sorduruyordu, cevabı bilinemez. Herkes tam
    modla başlar; Sade Ayarlar'dan açılır. Fikir Super Productivity ve Bluesky'den: seçenek değil önce deneyim, ayrıntı bağlamında.
  */
  const scrollViewRef = useRef<any>(null);
  // Kaydırma konumu yerel sürücüde: görsel paralaksı, metin ve sayfa göstergesi parmağı izler.
  const scrollX = useRef(new Animated.Value(0)).current;

  const isSmallDevice = height < 750;
  const visualSize = Math.min(width * 0.72, height * 0.3);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / width);
    if (index !== currentIndex && index >= 0 && index < SLIDES.length) {
      setCurrentIndex(index);
      haptic.surface();
    }
  };

  /**
   * TANITIMI KAPATIR — tercih yazılır, bayrak kalıcı olur, çıkılır.
   *
   * İki çıkış da (hesapla devam / hesapsız dene) buradan geçiyor: eskiden aynı beş
   * satır iki yerde kopyalanmıştı ve biri güncellendiğinde diğeri geride kalıyordu.
   */
  const completeOnboarding = async (exit: 'continue' | 'guest') => {
    haptic.commit();
    if (exit === 'guest') useAuthStore.getState().startGuest(); // misafir oturumu çıkıştan ÖNCE: ana sayfadaki hoş geldin + "Aklındakileri yaz" misafiri tanısın (bkz. guestMode.test)
    try {
      await AsyncStorage.setItem('tazq-onboarding-done', 'true');
    } catch (e) {
      swallow('onboarding.persistCompletedFlag', e, { capture: true });
    }
    usePrefsStore.getState().setOnboardingCompleted(true);
    track('onboarding_completed', { skipped: false, lastStep: currentIndex, guest: exit === 'guest' });

    if (exit === 'guest') {
      goHome(router);
      return;
    }
    const nextPath = useAuthStore.getState().token ? '/' : '/login';
    router.replace(nextPath as any);
  };

  const nextSlide = () => {
    if (currentIndex < SLIDES.length - 1) {
      scrollViewRef.current?.scrollTo({ x: (currentIndex + 1) * width, animated: true });
    } else {
      void completeOnboarding('continue');
    }
  };

  /*
    DİNAMİK ANAHTAR OKUMA — TEK YERDE. Slaytlar (title/bodyKey) çalışma anında belirlenen bir anahtarla
    `t`den metin okuyor; `as any` kaçışı burada TEK satıra toplanıyor, her çağrı
    yerine ayrı ayrı yazılmıyor (bkz. typeSafety.test.ts'in `as any` tavanı).
  */
  const textOf = (key: string): string => {
    if (!t) return key;
    return (t as any)[key] || key;
  };

  const getText = (item: typeof SLIDES[0], isTitle: boolean) => {
    if (!t) return isTitle ? item.titleKey : item.bodyKey;
    const key = isTitle ? item.titleKey : item.bodyKey;
    return textOf(key);
  };

  /** -1 · 0 · 1: slaytın ekrana göre konumu (solda · ortada · sağda). */
  const posOf = (index: number) =>
    scrollX.interpolate({ inputRange: [(index - 1) * width, index * width, (index + 1) * width], outputRange: [-1, 0, 1], extrapolate: 'clamp' });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
            <Text style={[styles.logoTop, { color: theme.onSurface }]}>TAZQ</Text>
            <Touchable 
                onPress={async () => {
                    try { await AsyncStorage.setItem('tazq-onboarding-done', 'true'); } catch (e) { swallow('onboarding.persistCompletedFlag', e, { capture: true }); }
                    usePrefsStore.getState().setOnboardingCompleted(true);
                    track('onboarding_completed', { skipped: true, lastStep: currentIndex });
                    const nextPath = useAuthStore.getState().token ? '/' : '/login';
                    router.replace(nextPath as any);
                }}
                style={styles.skipBtn}
                accessibilityRole="button"
                accessibilityLabel={language === 'tr' ? 'Tanıtımı geç' : 'Skip intro'}
                accessibilityHint={language === 'tr' ? 'Doğrudan giriş ekranına gider' : 'Goes straight to the sign-in screen'}
            >
                <Text style={[styles.skipText, { color: theme.onSurfaceVariant }]}>{t.skip}</Text>
            </Touchable>
        </View>

        <Animated.ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true, listener: handleScroll })}
          scrollEventThrottle={16}
          contentContainerStyle={{ alignItems: 'center' }}
        >
          {SLIDES.map((item, index) => {
            /*
              PARALAKS (Apple tanıtım ekranlarının dili): görsel ve metin sayfadan HIZLI kayar —
              gelen slayt kenardan sarkmaz (yavaş kaydırma komşu görseli içeri taşıyordu); uzaklaşan slayt hafifçe küçülür ve solar. Hepsi kaydırmanın
              kendisine bağlı — parmak durursa animasyon da durur, geri sürüklenirse geri gelir.
            */
            const pos = posOf(index);
            const visualStyle = {
              opacity: pos.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.35, 1, 0.35] }),
              transform: [
                { translateX: pos.interpolate({ inputRange: [-1, 0, 1], outputRange: [width * 0.3, 0, -width * 0.3] }) },
                { scale: pos.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.86, 1, 0.86] }) },
              ],
            };
            const textStyle = (k: number) => ({
              opacity: pos.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
              transform: [{ translateX: pos.interpolate({ inputRange: [-1, 0, 1], outputRange: [width * 0.12 * k, 0, -width * 0.12 * k] }) }],
            });
            return (
            <View key={item.id} style={[styles.slide, { width }]}>
                <Animated.View style={[styles.visualContainer, visualStyle]}>
                    <OnboardingVisual
                      kind={item.type}
                      active={currentIndex === index}
                      theme={theme}
                      isDark={isDark}
                      tr={tr}
                      width={width - S.slg * 2}
                      height={visualSize}
                    />
                </Animated.View>
                <View style={[styles.textContainer, { minHeight: isSmallDevice ? 110 : 150 }]}>
                    <Animated.Text
                        style={[styles.title, textStyle(1), { color: theme.onSurface, fontSize: isSmallDevice ? 32 : 40, lineHeight: isSmallDevice ? 40 : 48, letterSpacing: Platform.OS === 'ios' ? -2.5 : trackingFor(isSmallDevice ? 32 : 40) }]}
                    >
                        {getText(item, true)}
                    </Animated.Text>
                    <Animated.Text
                        style={[styles.sub, textStyle(1.6), { color: theme.onSurfaceVariant, fontSize: isSmallDevice ? 14 : 16 }]}
                    >
                        {getText(item, false)}
                    </Animated.Text>
                </View>
            </View>
            );
          })}
        </Animated.ScrollView>

        <View style={styles.footer}>
          {/* Sayfa göstergesi: hap, parmakla birlikte noktadan noktaya kayar. */}
          <View style={styles.indicatorContainer} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {SLIDES.map((_, index) => (
              <View key={index} style={[styles.indicator, { backgroundColor: theme.onSurfaceVariant + '55' }]} />
            ))}
            <Animated.View
              style={[
                styles.indicatorPill,
                { backgroundColor: theme.primaryFill, transform: [{ translateX: scrollX.interpolate({ inputRange: [0, width], outputRange: [0, DOT_STEP] }) }] },
              ]}
            />
          </View>

          {/*
            HESAPSIZ DENEME — son slaytta, kayıt duvarının hemen önünde.

            Tanıtım biter bitmez kullanıcı /login'e atılıyordu: bir yapılacaklar
            uygulamasını denemek için önce e-posta, şifre ve 13-yaş onayı isteniyordu.
            Çekirdek zaten yerel çalıştığı için bu bir zorunluluk değildi.
          */}
          {currentIndex === SLIDES.length - 1 && (
            <Touchable
              onPress={() => { void completeOnboarding('guest'); }}
              accessibilityRole="button"
              accessibilityLabel={t.guest.tryWithoutAccount}
              accessibilityHint={t.guest.tryHint}
              style={{ alignSelf: 'center', paddingVertical: S.sm, paddingHorizontal: S.md }}
            >
              <Text style={{ fontSize: F.body, fontWeight: '700', color: theme.primary }}>
                {t.guest.tryWithoutAccount}
              </Text>
            </Touchable>
          )}

          <Touchable 
            onPress={nextSlide} 
            activeOpacity={0.8} 
            accessibilityRole="button"
            accessibilityLabel={currentIndex === SLIDES.length - 1 ? t.welcome.getStarted : t.next}
            accessibilityHint={language === 'tr' ? `${currentIndex + 1} / ${SLIDES.length}. adım` : `Step ${currentIndex + 1} of ${SLIDES.length}`}
            style={[styles.nextBtn, { backgroundColor: theme.primaryFill, height: isSmallDevice ? 56 : 64 }, !isDark && styles.clayShadow]}
          >
             <Text style={[styles.nextBtnText, { color: theme.onPrimaryFill, fontSize: isSmallDevice ? 16 : 18 }]}>
                {currentIndex === SLIDES.length - 1 ? t.welcome.getStarted : t.next}
             </Text>
             <ChevronRight size={ICON.md} color={theme.onPrimaryFill} strokeWidth={3} />
          </Touchable>
        </View>
      </SafeAreaView>

    </View>
  );
}

/** Sayfa göstergesi ölçüleri — hap bir noktadan ötekine tam DOT_STEP kayar. */
const DOT = 8;
const DOT_GAP = S.smd;
const DOT_STEP = DOT + DOT_GAP;
const PILL = 24;

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.slg, paddingTop: Platform.OS === 'ios' ? 8 : 16 },
  // letterSpacing -2 çok sıkıydı: iOS son glifi (Q) metin kutusundan sağdan kırpıyordu.
  // -1 + küçük sağ pay glif taşmasına yer açar.
  logoTop: { fontSize: 24, fontFamily: 'Jakarta-ExtraBold', letterSpacing: -1, paddingRight: S.xs },
  skipBtn: { padding: S.sm },
  skipText: { fontSize: 14, fontWeight: '700' },
  slide: { height: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: S.slg },
  visualContainer: { alignItems: 'center', justifyContent: 'center', height: '35%', marginBottom: S.xl },
  textContainer: { marginTop: S.smd, alignItems: 'center', gap: S.sm, paddingHorizontal: S.smd },
  title: { fontFamily: 'Jakarta-ExtraBold', textAlign: 'center' }, // harf aralığı kullanım yerinde, platforma göre (bkz. androidParity.test)
  sub: { fontWeight: '500', textAlign: 'center', lineHeight: 22, paddingHorizontal: S.xs },
  footer: { paddingHorizontal: S.slg, paddingBottom: Platform.OS === 'ios' ? 16 : 24, gap: S.md },
  indicatorContainer: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: DOT_GAP },
  indicator: { width: DOT, height: DOT, borderRadius: R.full },
  indicatorPill: { position: 'absolute', left: -(PILL - DOT) / 2, width: PILL, height: DOT, borderRadius: R.full },
  nextBtn: { borderRadius: R.xl, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm },
  clayShadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 15 },
  nextBtnText: { fontWeight: '700' },
});

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/CrashFallback'; // çökerse yalnız bu ekran düşer
