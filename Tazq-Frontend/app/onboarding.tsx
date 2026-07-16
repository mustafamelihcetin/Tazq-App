import React, { useState, useRef, useEffect } from 'react';
import { S, ICON, R, B } from '@/shared/constants/tokens';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView, MotiText } from 'moti';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { ChevronRight, Clock, Smartphone, Lock, Cloud, Ban, Coins, GraduationCap, Calendar, Zap, Bell, Flame, ListChecks } from 'lucide-react-native';
import { CategoryColors } from '@/shared/constants/Colors';
import * as Haptics from 'expo-haptics';
import { Easing } from 'react-native-reanimated';
import { TazqLogo } from '@/shared/components/TazqLogo';
import { Touchable } from '@/shared/components/Touchable';
import { track } from '@/shared/utils/analytics';
import { usePrefsStore } from '@/features/modes';
import { useAuthStore } from '@/features/user';
import { swallow } from '@/shared/utils/swallow';

const SLIDES = [
  {
    id: '1',
    titleKey: 'onboardingTitle1',
    bodyKey: 'onboardingBody1',
    accentKey: 'primary',
    type: 'welcome',
  },
  {
    id: '2',
    titleKey: 'onboardingTitle2b',
    bodyKey: 'onboardingBody2b',
    accentKey: 'teal',
    type: 'smart_input',
  },
  {
    id: 'privacy',
    titleKey: 'onboardingTitlePrivacy',
    bodyKey: 'onboardingBodyPrivacy',
    accentKey: 'success',
    type: 'privacy',
  },
  {
    id: 'modes',
    titleKey: 'onboardingTitleModes',
    bodyKey: 'onboardingBodyModes',
    accentKey: 'secondary',
    type: 'modes',
  },
  {
    id: '3',
    titleKey: 'onboardingTitle3',
    bodyKey: 'onboardingBody3b',
    accentKey: 'error',
    type: 'focus',
  },
  {
    id: '4',
    titleKey: 'onboardingTitle4c',
    bodyKey: 'onboardingBody4c',
    accentKey: 'indigo',
    type: 'cockpit',
  },
  {
    id: '5',
    titleKey: 'onboardingTitle4b',
    bodyKey: 'onboardingBody4b',
    accentKey: 'warning',
    type: 'momentum',
  },
];

export default function OnboardingScreen() {
  const { theme, isDark } = useAppTheme();
  const { t, language } = useLanguageStore();
  const tr = language === 'tr';
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const isSmallDevice = height < 750;
  const visualSize = Math.min(width * 0.72, height * 0.3);

  // Slayt vurgu rengi → palet token'ı (tema-duyarlı ve marka-içi).
  // teal/indigo CategoryColors'tan (iki temada da WCAG-ayarlı tek değer); gerisi temadan.
  const accentOf = (key: string): string => {
    if (key === 'teal') return CategoryColors.teal;
    if (key === 'indigo') return CategoryColors.indigo;
    return (theme as Record<string, string>)[key] ?? theme.primary;
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setTimerSeconds(s => (s + 1) % 60);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / width);
    if (index !== currentIndex && index >= 0 && index < SLIDES.length) {
      setCurrentIndex(index);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const nextSlide = async () => {
    if (currentIndex < SLIDES.length - 1) {
      scrollViewRef.current?.scrollTo({ x: (currentIndex + 1) * width, animated: true });
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        await AsyncStorage.setItem('tazq-onboarding-done', 'true');
      } catch (e) {
        console.warn('Failed to save onboarding status');
      }
      usePrefsStore.getState().setOnboardingCompleted(true);
      track('onboarding_completed', { skipped: false, lastStep: currentIndex });
      const nextPath = useAuthStore.getState().token ? '/' : '/login';
      router.replace(nextPath as any);
    }
  };

  const getText = (item: typeof SLIDES[0], isTitle: boolean) => {
    if (!t) return isTitle ? item.titleKey : item.bodyKey;
    const key = isTitle ? item.titleKey : item.bodyKey;
    return (t as any)[key] || key;
  };

  const renderVisual = (item: typeof SLIDES[0], index: number) => {
    const isActive = currentIndex === index;
    const accent = accentOf(item.accentKey);

    switch (item.type) {
      case 'welcome':
        return (
          <View style={[styles.visualCard, { width: visualSize, height: visualSize }]}>
            {/* Animated concentric rings */}
            {[1, 0.72, 0.48].map((scale, i) => (
              <MotiView
                key={i}
                animate={{
                  scale: isActive ? [scale, scale * 1.12, scale] : scale * 0.8,
                  opacity: isActive ? [0.14, 0.06, 0.14] : 0,
                }}
                transition={{ loop: true, duration: 3200 + i * 700, delay: i * 350 }}
                style={{
                  position: 'absolute',
                  width: visualSize,
                  height: visualSize,
                  borderRadius: visualSize / 2,
                  borderWidth: B.medium,
                  borderColor: accent,
                }}
              />
            ))}
            {/* Center logo */}
            <MotiView
              animate={{ scale: isActive ? 1 : 0.75, opacity: isActive ? 1 : 0 }}
              transition={{ type: 'spring', damping: 14, delay: 150 }}
              style={{ alignItems: 'center', justifyContent: 'center' }}
            >
              <TazqLogo size={isSmallDevice ? 72 : 92} />
            </MotiView>
            {/* Glow blob */}
            <MotiView
              animate={{ scale: isActive ? [1, 1.2, 1] : 0.8, opacity: isActive ? 0.08 : 0 }}
              transition={{ loop: true, duration: 5000 }}
              style={[styles.glowBlob, { backgroundColor: accent, width: visualSize, height: visualSize }]}
            />
          </View>
        );
      case 'focus':
        return (
          <View style={[styles.visualCard, styles.withFrame, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.outlineVariant, width: visualSize, height: visualSize }]}>
             <MotiView 
                animate={{ rotate: isActive ? '360deg' : '0deg' }}
                transition={{ rotate: { loop: true, duration: 30000, type: 'timing', easing: Easing.linear } }}
                style={[styles.cinematicRing, { borderColor: theme.tertiary + '30', width: visualSize * 0.6, height: visualSize * 0.6, borderRadius: visualSize }]}
             />
             <View style={styles.cinematicTimer}>
                <Clock size={isSmallDevice ? 45 : 65} color={theme.tertiary} />
                <Text style={[styles.cinematicTimeText, { color: theme.onSurface, fontSize: isSmallDevice ? 24 : 36 }]}>
                    {`24:${(59 - timerSeconds % 60).toString().padStart(2, '0')}`}
                </Text>
             </View>
          </View>
        );
      case 'smart_input':
        return (
          <View style={[styles.visualCard, styles.withFrame, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.outlineVariant, width: visualSize, height: visualSize }]}>
            <View style={styles.simContainer}>
              {[
                { text: tr ? 'yarın teslim et' : 'submit tomorrow', Ic: Calendar, badge: tr ? 'Yarın' : 'Tomorrow', color: theme.tertiary },
                { text: tr ? 'acil rapor yaz' : 'urgent report', Ic: Zap, badge: tr ? 'Yüksek' : 'High', color: theme.error },
                { text: tr ? 'hatırlatıcı ekle' : 'add reminder', Ic: Bell, badge: tr ? 'Bildirim' : 'Reminder', color: theme.primary },
              ].map((row, i) => (
                <MotiView
                  key={i}
                  animate={{ translateX: isActive ? 0 : 40, opacity: isActive ? 1 : 0 }}
                  transition={{ delay: 300 + i * 120, type: 'spring' }}
                  style={[styles.cinematicTask, { backgroundColor: theme.surfaceContainerHighest, height: isSmallDevice ? 38 : 46 }]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={[styles.cinematicLine, { backgroundColor: theme.outlineVariant, width: '70%' }]} />
                  </View>
                  <MotiView
                    animate={{ scale: isActive ? 1 : 0.6, opacity: isActive ? 1 : 0 }}
                    transition={{ delay: 600 + i * 120, type: 'spring' }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: S.xxs, backgroundColor: row.color + '22', paddingHorizontal: S.sm, paddingVertical: S.xs, borderRadius: R.sm }}
                  >
                    <row.Ic size={ICON.xs} color={row.color} strokeWidth={2.5} />
                    <Text style={{ fontSize: 9, fontWeight: '700', color: row.color }}>{row.badge}</Text>
                  </MotiView>
                </MotiView>
              ))}
            </View>
          </View>
        );
      case 'privacy':
        return (
          <View style={[styles.visualCard, styles.withFrame, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.outlineVariant, width: visualSize, height: visualSize }]}>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.lmd, paddingHorizontal: S.md }}>
              {/* Top Row: Device -> Lock -> Server Cloud */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                
                {/* Local Device */}
                <MotiView 
                  animate={{ scale: isActive ? 1 : 0.8 }} 
                  style={{ alignItems: 'center', gap: S.xs, width: 60 }}
                >
                  <Smartphone size={ICON.lg} color={theme.onSurface} />
                  <Text style={{ fontSize: 9, fontWeight: '700', color: theme.onSurfaceVariant }}>{tr ? 'Cihazınız' : 'Your Device'}</Text>
                </MotiView>

                {/* Animated Line with Data Packet */}
                <View style={{ flex: 1, height: 2, backgroundColor: theme.outlineVariant, position: 'relative', marginHorizontal: S.sm, justifyContent: 'center' }}>
                  {/* Lock symbol in the center */}
                  <View style={{ position: 'absolute', left: '50%', marginLeft: -12, top: -11, width: 24, height: 24, borderRadius: R.full, backgroundColor: theme.success, alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                    <Lock size={ICON.xs} color="#fff" />
                  </View>
                  
                  {/* Animated data packet */}
                  <MotiView
                    animate={{
                      left: isActive ? ['0%', '100%'] : '0%',
                      backgroundColor: isActive ? [theme.primary, theme.success] : theme.primary,
                    }}
                    transition={{
                      loop: true,
                      duration: 2500,
                      type: 'timing',
                      easing: Easing.bezier(0.4, 0, 0.2, 1),
                    }}
                    style={{
                      position: 'absolute',
                      width: 8,
                      height: 8,
                      borderRadius: R.full,
                      top: -3,
                    }}
                  />
                </View>

                {/* Secure Server */}
                <MotiView 
                  animate={{ scale: isActive ? 1 : 0.8 }} 
                  style={{ alignItems: 'center', gap: S.xs, width: 60 }}
                >
                  <Cloud size={ICON.lg} color={theme.onSurface} />
                  <Text style={{ fontSize: 9, fontWeight: '700', color: theme.onSurfaceVariant }}>{tr ? 'Sunucu' : 'Server'}</Text>
                </MotiView>

              </View>

              {/* Bottom Row: Demonstration of Encryption */}
              <View style={{ width: '100%', gap: S.sm, marginTop: S.smd }}>
                {/* Plain Text row */}
                <MotiView 
                  animate={{ translateX: isActive ? 0 : -20, opacity: isActive ? 1 : 0 }}
                  transition={{ delay: 300 }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: theme.surfaceContainerHighest, padding: S.sm, borderRadius: R.sm }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '700', color: theme.primary }}>PLAIN:</Text>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: theme.onSurface }}>"TAZQ Toplantısı"</Text>
                </MotiView>

                {/* Encrypted Text row */}
                <MotiView 
                  animate={{ translateX: isActive ? 0 : 20, opacity: isActive ? 1 : 0 }}
                  transition={{ delay: 700 }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: theme.success + '1A', padding: S.sm, borderRadius: R.sm, borderWidth: 1, borderColor: theme.success + '30' }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '700', color: theme.success }}>CIPHER:</Text>
                  <MotiText 
                    animate={{ opacity: isActive ? [1, 0.4, 1] : 1 }}
                    transition={{ loop: true, duration: 2000 }}
                    style={{ fontSize: 10, fontWeight: '700', color: theme.success, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}
                  >
                    "U0dWMmJYTkVhVzg9"
                  </MotiText>
                </MotiView>
              </View>
            </View>
          </View>
        );
      case 'momentum':
        return (
          <View style={[styles.visualCard, styles.withFrame, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.outlineVariant, width: visualSize, height: visualSize }]}>
            <View style={{ alignItems: 'center', justifyContent: 'center', gap: S.md, flex: 1, paddingHorizontal: S.lmd }}>
              <MotiView
                animate={{ scale: isActive ? 1 : 0.7, opacity: isActive ? 1 : 0 }}
                transition={{ type: 'spring', damping: 14 }}
              >
                <Text style={{ fontSize: isSmallDevice ? 52 : 64, fontWeight: '700', letterSpacing: -4, color: accent, lineHeight: isSmallDevice ? 56 : 70 }}>78</Text>
                <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: accent, opacity: 0.5, textAlign: 'center' }}>MOMENTUM</Text>
              </MotiView>
              {[
                { Ic: ListChecks, label: tr ? 'Görevler' : 'Tasks', pct: '40%', c: theme.success },
                { Ic: Zap, label: tr ? 'Odak' : 'Focus', pct: '35%', c: theme.primary },
                { Ic: Flame, label: tr ? 'Seri' : 'Streak', pct: '25%', c: theme.streak },
              ].map((row, i) => (
                <MotiView
                  key={i}
                  animate={{ translateX: isActive ? 0 : 30, opacity: isActive ? 1 : 0 }}
                  transition={{ delay: 400 + i * 100, type: 'spring' }}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', backgroundColor: accent + '18', borderRadius: R.sm, paddingHorizontal: S.smd, paddingVertical: S.sm }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                    <row.Ic size={ICON.xs} color={row.c} strokeWidth={2.5} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.onSurface }}>{row.label}</Text>
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: accent }}>{row.pct}</Text>
                </MotiView>
              ))}
            </View>
          </View>
        );
      case 'modes':
        return (
          <View style={[styles.visualCard, styles.withFrame, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.outlineVariant, width: visualSize, height: visualSize }]}>
            <View style={{ alignItems: 'center', justifyContent: 'center', gap: S.smd, flex: 1, paddingHorizontal: S.lmd }}>
              {[
                { icon: <Ban size={isSmallDevice ? 20 : 24} color={theme.error} />, label: tr ? 'Sigarayı Bırak' : 'Quit Smoking', sub: tr ? 'Gün gün plan' : 'Day-by-day plan', color: theme.error },
                { icon: <Coins size={isSmallDevice ? 20 : 24} color={theme.tertiary} />, label: tr ? 'Tasarruf' : 'Save Money', sub: tr ? 'Birikim hedefi' : 'Savings goal', color: theme.tertiary },
                { icon: <GraduationCap size={isSmallDevice ? 20 : 24} color={accent} />, label: tr ? 'Sınava Hazırlık' : 'Exam Prep', sub: tr ? 'Günlük program' : 'Daily plan', color: accent },
              ].map((row, i) => (
                <MotiView
                  key={i}
                  animate={{ translateX: isActive ? 0 : 36, opacity: isActive ? 1 : 0 }}
                  transition={{ delay: 300 + i * 130, type: 'spring' }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: S.smd, width: '100%', backgroundColor: row.color + '14', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: isSmallDevice ? 9 : 12 }}
                >
                  <View style={{ width: isSmallDevice ? 26 : 30, alignItems: 'center', justifyContent: 'center' }}>
                    {row.icon}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: isSmallDevice ? 12 : 14, fontWeight: '700', color: theme.onSurface }}>{row.label}</Text>
                    <Text style={{ fontSize: 10, fontWeight: '600', color: theme.onSurfaceMuted }}>{row.sub}</Text>
                  </View>
                  <View style={{ width: 30, height: 18, borderRadius: R.sm, backgroundColor: row.color, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: S.xxs }}>
                    <View style={{ width: 14, height: 14, borderRadius: R.full, backgroundColor: '#fff' }} />
                  </View>
                </MotiView>
              ))}
            </View>
          </View>
        );
      case 'cockpit':
        return (
          <View style={[styles.visualCard, styles.withFrame, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.outlineVariant, width: visualSize, height: visualSize }]}>
            <View style={styles.simContainer}>
              <MotiView
                animate={{ opacity: isActive ? 1 : 0, translateY: isActive ? 0 : -10 }}
                transition={{ type: 'spring', delay: 200 }}
                style={{ width: '100%' }}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: accent, opacity: 0.7, marginBottom: S.sm }}>{tr ? 'HAFTALIK MERKEZ' : 'WEEKLY HUB'}</Text>
                <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.sm }}>
                  {(tr ? ['P', 'S', 'Ç', 'P', 'C', 'C', 'P'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S']).map((d, i) => (
                    <MotiView
                      key={i}
                      animate={{ scale: isActive ? 1 : 0.5, opacity: isActive ? 1 : 0 }}
                      transition={{ delay: 400 + i * 60, type: 'spring' }}
                      style={{ flex: 1, alignItems: 'center', backgroundColor: i === 4 ? accent : theme.surfaceContainerHighest, borderRadius: R.sm, paddingVertical: S.sm }}
                    >
                      <Text style={{ fontSize: 9, fontWeight: '700', color: i === 4 ? '#fff' : theme.onSurfaceVariant }}>{d}</Text>
                    </MotiView>
                  ))}
                </View>
                {[40, 75, 55, 90].map((h, i) => (
                  <MotiView
                    key={i}
                    animate={{ width: isActive ? `${h}%` : '5%' } as any}
                    transition={{ delay: 800 + i * 80, type: 'timing', duration: 500 }}
                    style={{ height: 8, borderRadius: R.xs, backgroundColor: accent + (i === 3 ? 'FF' : '55'), marginBottom: S.xs }}
                  />
                ))}
              </MotiView>
            </View>
          </View>
        );
      default:
        return null;
    }
  };

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
            >
                <Text style={[styles.skipText, { color: theme.onSurfaceVariant }]}>{t.skip}</Text>
            </Touchable>
        </View>

        <ScrollView 
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ alignItems: 'center' }}
        >
          {SLIDES.map((item, index) => (
            <View key={item.id} style={[styles.slide, { width }]}>
                <View style={styles.visualContainer}>
                    {renderVisual(item, index)}
                </View>
                <View style={[styles.textContainer, { minHeight: isSmallDevice ? 110 : 150 }]}>
                    <MotiText 
                        key={`title-${index}`}
                        animate={{ 
                            opacity: currentIndex === index ? 1 : 0, 
                            translateY: currentIndex === index ? 0 : 15 
                        }}
                        style={[styles.title, { color: theme.onSurface, fontSize: isSmallDevice ? 32 : 44, lineHeight: isSmallDevice ? 32 : 44 }]}
                    >
                        {getText(item, true)}
                    </MotiText>
                    <MotiText 
                        key={`sub-${index}`}
                        animate={{ 
                            opacity: currentIndex === index ? 1 : 0, 
                            translateY: currentIndex === index ? 0 : 10 
                        }}
                        transition={{ delay: 100 }}
                        style={[styles.sub, { color: theme.onSurfaceVariant, fontSize: isSmallDevice ? 14 : 16 }]}
                    >
                        {getText(item, false)}
                    </MotiText>
                </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.indicatorContainer}>
            {SLIDES.map((_, index) => (
              <MotiView
                key={index}
                animate={{
                    width: currentIndex === index ? 28 : 8,
                    opacity: currentIndex === index ? 1 : 0.35,
                    backgroundColor: currentIndex === index ? theme.primary : theme.onSurfaceVariant,
                }}
                style={styles.indicator}
              />
            ))}
            {currentIndex < SLIDES.length - 1 && (
              <MotiView
                animate={{ translateX: [0, 6, 0], opacity: [0.5, 1, 0.5] }}
                transition={{ loop: true, duration: 1600 }}
                style={{ position: 'absolute', right: -28 }}
              >
                <ChevronRight size={ICON.sm} color={theme.onSurfaceVariant} />
              </MotiView>
            )}
          </View>

          <Touchable 
            onPress={nextSlide} 
            activeOpacity={0.8} 
            style={[styles.nextBtn, { backgroundColor: theme.primary, height: isSmallDevice ? 56 : 64 }, !isDark && styles.clayShadow]}
          >
             <Text style={[styles.nextBtnText, { color: theme.onPrimary, fontSize: isSmallDevice ? 16 : 18 }]}>
                {currentIndex === SLIDES.length - 1 ? t.welcome.getStarted : t.next}
             </Text>
             <ChevronRight size={ICON.md} color={theme.onPrimary} strokeWidth={3} />
          </Touchable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.slg, paddingTop: Platform.OS === 'ios' ? 8 : 16 },
  logoTop: { fontSize: 24, fontFamily: 'Jakarta-ExtraBold', letterSpacing: -2 },
  skipBtn: { padding: S.sm },
  skipText: { fontSize: 14, fontWeight: '700' },
  slide: { height: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: S.slg },
  visualContainer: { alignItems: 'center', justifyContent: 'center', height: '35%', marginBottom: S.xl },
  visualCard: { alignItems: 'center', justifyContent: 'center' },
  withFrame: { borderRadius: R.xl, borderWidth: B.thin, overflow: 'hidden' },
  sculptureWrapper: { zIndex: 2, alignItems: 'center', justifyContent: 'center' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  glowBlob: { position: 'absolute', borderRadius: R.full, zIndex: 1 },
  simContainer: { width: '100%', padding: S.md, gap: S.smd, alignItems: 'center' },
  centeredSim: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  cinematicTask: { width: '100%', borderRadius: R.md, flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.smd, gap: S.smd, overflow: 'hidden' },
  taskContent: { flex: 1, gap: S.sm },
  cinematicCheck: { width: 20, height: 20, borderRadius: R.sm, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  cinematicLine: { height: 6, borderRadius: R.xs },
  cinematicLineShort: { height: 6, borderRadius: R.xs },
  cinematicRing: { position: 'absolute', borderWidth: 5, borderStyle: 'dashed' },
  cinematicTimer: { alignItems: 'center', gap: S.smd },
  cinematicTimeText: { fontWeight: '700' },
  cinematicStats: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', padding: S.md, zIndex: 2 },
  cinematicChart: { flexDirection: 'row', alignItems: 'flex-end', gap: S.sm, height: '35%', width: '100%', justifyContent: 'center' },
  cinematicBar: { borderRadius: R.sm },
  floatingBadge: { marginTop: S.lg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.smd, paddingVertical: S.sm, borderRadius: R.lg, gap: S.xs },
  floatingBadgeText: { fontWeight: '700' },
  textContainer: { marginTop: S.smd, alignItems: 'center', gap: S.sm, paddingHorizontal: S.smd },
  title: { fontFamily: 'Jakarta-ExtraBold', textAlign: 'center', letterSpacing: -2.5 },
  sub: { fontWeight: '500', textAlign: 'center', lineHeight: 22, paddingHorizontal: S.xs },
  footer: { paddingHorizontal: S.slg, paddingBottom: Platform.OS === 'ios' ? 16 : 24, gap: S.md },
  indicatorContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: S.sm, position: 'relative', paddingRight: S.md },
  indicator: { height: 8, borderRadius: R.xs },
  nextBtn: { borderRadius: R.xl, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm },
  clayShadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 15 },
  nextBtnText: { fontWeight: '700' },
});

