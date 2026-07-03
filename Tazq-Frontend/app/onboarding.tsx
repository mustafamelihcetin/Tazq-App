import React, { useState, useRef, useEffect } from 'react';
import { B } from '@/shared/constants/tokens';
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
import { ChevronRight, Clock, Smartphone, Lock, Cloud, Ban, Coins, GraduationCap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Easing } from 'react-native-reanimated';
import { TazqLogo } from '@/shared/components/TazqLogo';
import { Touchable } from '@/shared/components/Touchable';
import { track } from '@/shared/utils/analytics';
import { usePrefsStore } from '@/features/modes';

const SLIDES = [
  {
    id: '1',
    titleKey: 'onboardingTitle1',
    bodyKey: 'onboardingBody1',
    color: '#3367ff',
    type: 'welcome',
  },
  {
    id: '2',
    titleKey: 'onboardingTitle2b',
    bodyKey: 'onboardingBody2b',
    color: '#00cc88',
    type: 'smart_input',
  },
  {
    id: 'privacy',
    titleKey: 'onboardingTitlePrivacy',
    bodyKey: 'onboardingBodyPrivacy',
    color: '#10b981',
    type: 'privacy',
  },
  {
    id: 'modes',
    titleKey: 'onboardingTitleModes',
    bodyKey: 'onboardingBodyModes',
    color: '#8b5cf6',
    type: 'modes',
  },
  {
    id: '3',
    titleKey: 'onboardingTitle3',
    bodyKey: 'onboardingBody3b',
    color: '#ff2d55',
    type: 'focus',
  },
  {
    id: '4',
    titleKey: 'onboardingTitle4c',
    bodyKey: 'onboardingBody4c',
    color: '#6200ee',
    type: 'cockpit',
  },
  {
    id: '5',
    titleKey: 'onboardingTitle4b',
    bodyKey: 'onboardingBody4b',
    color: '#f59e0b',
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
      router.replace('/login');
    }
  };

  const getText = (item: typeof SLIDES[0], isTitle: boolean) => {
    if (!t) return isTitle ? item.titleKey : item.bodyKey;
    const key = isTitle ? item.titleKey : item.bodyKey;
    return (t as any)[key] || key;
  };

  const renderVisual = (item: typeof SLIDES[0], index: number) => {
    const isActive = currentIndex === index;

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
                  borderColor: item.color,
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
              style={[styles.glowBlob, { backgroundColor: item.color, width: visualSize, height: visualSize }]}
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
                { text: tr ? 'yarın teslim et' : 'submit tomorrow', badge: tr ? '📅 Yarın' : '📅 Tomorrow', color: '#00cc88' },
                { text: tr ? 'acil rapor yaz' : 'urgent report', badge: tr ? '⚡ Yüksek' : '⚡ High', color: '#ff3b30' },
                { text: tr ? 'hatırlatıcı ekle' : 'add reminder', badge: tr ? '🔔 Bildirim' : '🔔 Reminder', color: theme.primary },
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
                    style={{ backgroundColor: row.color + '22', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 }}
                  >
                    <Text style={{ fontSize: 9, fontWeight: '800', color: row.color }}>{row.badge}</Text>
                  </MotiView>
                </MotiView>
              ))}
            </View>
          </View>
        );
      case 'privacy':
        return (
          <View style={[styles.visualCard, styles.withFrame, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.outlineVariant, width: visualSize, height: visualSize }]}>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 16 }}>
              {/* Top Row: Device -> Lock -> Server Cloud */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                
                {/* Local Device */}
                <MotiView 
                  animate={{ scale: isActive ? 1 : 0.8 }} 
                  style={{ alignItems: 'center', gap: 4, width: 60 }}
                >
                  <Smartphone size={24} color={theme.onSurface} />
                  <Text style={{ fontSize: 9, fontWeight: '700', color: theme.onSurfaceVariant }}>{tr ? 'Cihazınız' : 'Your Device'}</Text>
                </MotiView>

                {/* Animated Line with Data Packet */}
                <View style={{ flex: 1, height: 2, backgroundColor: theme.outlineVariant, position: 'relative', marginHorizontal: 8, justifyContent: 'center' }}>
                  {/* Lock symbol in the center */}
                  <View style={{ position: 'absolute', left: '50%', marginLeft: -12, top: -11, width: 24, height: 24, borderRadius: 12, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                    <Lock size={12} color="#fff" />
                  </View>
                  
                  {/* Animated data packet */}
                  <MotiView
                    animate={{
                      left: isActive ? ['0%', '100%'] : '0%',
                      backgroundColor: isActive ? ['#3367ff', '#10b981'] : '#3367ff',
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
                      borderRadius: 4,
                      top: -3,
                    }}
                  />
                </View>

                {/* Secure Server */}
                <MotiView 
                  animate={{ scale: isActive ? 1 : 0.8 }} 
                  style={{ alignItems: 'center', gap: 4, width: 60 }}
                >
                  <Cloud size={24} color={theme.onSurface} />
                  <Text style={{ fontSize: 9, fontWeight: '700', color: theme.onSurfaceVariant }}>{tr ? 'Sunucu' : 'Server'}</Text>
                </MotiView>

              </View>

              {/* Bottom Row: Demonstration of Encryption */}
              <View style={{ width: '100%', gap: 8, marginTop: 10 }}>
                {/* Plain Text row */}
                <MotiView 
                  animate={{ translateX: isActive ? 0 : -20, opacity: isActive ? 1 : 0 }}
                  transition={{ delay: 300 }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.surfaceContainerHighest, padding: 8, borderRadius: 8 }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#3367ff' }}>PLAIN:</Text>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: theme.onSurface }}>"TAZQ Toplantısı"</Text>
                </MotiView>

                {/* Encrypted Text row */}
                <MotiView 
                  animate={{ translateX: isActive ? 0 : 20, opacity: isActive ? 1 : 0 }}
                  transition={{ delay: 700 }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#10b9811A', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#10b98130' }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#10b981' }}>CIPHER:</Text>
                  <MotiText 
                    animate={{ opacity: isActive ? [1, 0.4, 1] : 1 }}
                    transition={{ loop: true, duration: 2000 }}
                    style={{ fontSize: 10, fontWeight: '700', color: '#10b981', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}
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
            <View style={{ alignItems: 'center', justifyContent: 'center', gap: 14, flex: 1, paddingHorizontal: 20 }}>
              <MotiView
                animate={{ scale: isActive ? 1 : 0.7, opacity: isActive ? 1 : 0 }}
                transition={{ type: 'spring', damping: 14 }}
              >
                <Text style={{ fontSize: isSmallDevice ? 52 : 64, fontWeight: '900', letterSpacing: -4, color: item.color, lineHeight: isSmallDevice ? 56 : 70 }}>78</Text>
                <Text style={{ fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: item.color, opacity: 0.5, textAlign: 'center' }}>MOMENTUM</Text>
              </MotiView>
              {[
                { label: tr ? '✅ Görevler' : '✅ Tasks', pct: '40%' },
                { label: tr ? '⚡ Odak' : '⚡ Focus', pct: '35%' },
                { label: tr ? '🔥 Seri' : '🔥 Streak', pct: '25%' },
              ].map((row, i) => (
                <MotiView
                  key={i}
                  animate={{ translateX: isActive ? 0 : 30, opacity: isActive ? 1 : 0 }}
                  transition={{ delay: 400 + i * 100, type: 'spring' }}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', backgroundColor: item.color + '18', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.onSurface }}>{row.label}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: item.color }}>{row.pct}</Text>
                </MotiView>
              ))}
            </View>
          </View>
        );
      case 'modes':
        return (
          <View style={[styles.visualCard, styles.withFrame, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.outlineVariant, width: visualSize, height: visualSize }]}>
            <View style={{ alignItems: 'center', justifyContent: 'center', gap: 10, flex: 1, paddingHorizontal: 20 }}>
              {[
                { icon: <Ban size={isSmallDevice ? 20 : 24} color="#ff2d55" />, label: tr ? 'Sigarayı Bırak' : 'Quit Smoking', sub: tr ? 'Gün gün plan' : 'Day-by-day plan', color: '#ff2d55' },
                { icon: <Coins size={isSmallDevice ? 20 : 24} color="#00cc88" />, label: tr ? 'Tasarruf' : 'Save Money', sub: tr ? 'Birikim hedefi' : 'Savings goal', color: '#00cc88' },
                { icon: <GraduationCap size={isSmallDevice ? 20 : 24} color={item.color} />, label: tr ? 'Sınava Hazırlık' : 'Exam Prep', sub: tr ? 'Günlük program' : 'Daily plan', color: item.color },
              ].map((row, i) => (
                <MotiView
                  key={i}
                  animate={{ translateX: isActive ? 0 : 36, opacity: isActive ? 1 : 0 }}
                  transition={{ delay: 300 + i * 130, type: 'spring' }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', backgroundColor: row.color + '14', borderRadius: 14, paddingHorizontal: 14, paddingVertical: isSmallDevice ? 9 : 12 }}
                >
                  <View style={{ width: isSmallDevice ? 26 : 30, alignItems: 'center', justifyContent: 'center' }}>
                    {row.icon}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: isSmallDevice ? 12 : 14, fontWeight: '800', color: theme.onSurface }}>{row.label}</Text>
                    <Text style={{ fontSize: 10, fontWeight: '600', color: theme.onSurfaceVariant, opacity: 0.7 }}>{row.sub}</Text>
                  </View>
                  <View style={{ width: 30, height: 18, borderRadius: 9, backgroundColor: row.color, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 2 }}>
                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff' }} />
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
                <Text style={{ fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: item.color, opacity: 0.7, marginBottom: 8 }}>{tr ? 'HAFTALIK MERKEZ' : 'WEEKLY HUB'}</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                  {(tr ? ['P', 'S', 'Ç', 'P', 'C', 'C', 'P'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S']).map((d, i) => (
                    <MotiView
                      key={i}
                      animate={{ scale: isActive ? 1 : 0.5, opacity: isActive ? 1 : 0 }}
                      transition={{ delay: 400 + i * 60, type: 'spring' }}
                      style={{ flex: 1, alignItems: 'center', backgroundColor: i === 4 ? item.color : theme.surfaceContainerHighest, borderRadius: 8, paddingVertical: 6 }}
                    >
                      <Text style={{ fontSize: 9, fontWeight: '800', color: i === 4 ? '#fff' : theme.onSurfaceVariant }}>{d}</Text>
                    </MotiView>
                  ))}
                </View>
                {[40, 75, 55, 90].map((h, i) => (
                  <MotiView
                    key={i}
                    animate={{ width: isActive ? `${h}%` : '5%' } as any}
                    transition={{ delay: 800 + i * 80, type: 'timing', duration: 500 }}
                    style={{ height: 8, borderRadius: 4, backgroundColor: item.color + (i === 3 ? 'FF' : '55'), marginBottom: 5 }}
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
                    try { await AsyncStorage.setItem('tazq-onboarding-done', 'true'); } catch {}
                    usePrefsStore.getState().setOnboardingCompleted(true);
                    track('onboarding_completed', { skipped: true, lastStep: currentIndex });
                    router.replace('/login');
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
                <ChevronRight size={16} color={theme.onSurfaceVariant} />
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
             <ChevronRight size={20} color={theme.onPrimary} strokeWidth={3} />
          </Touchable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 32, paddingTop: Platform.OS === 'ios' ? 8 : 16 },
  logoTop: { fontSize: 24, fontFamily: 'Jakarta-ExtraBold', letterSpacing: -2 },
  skipBtn: { padding: 8 },
  skipText: { fontSize: 14, fontWeight: '800' },
  slide: { height: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  visualContainer: { alignItems: 'center', justifyContent: 'center', height: '35%', marginBottom: 40 },
  visualCard: { alignItems: 'center', justifyContent: 'center' },
  withFrame: { borderRadius: 40, borderWidth: B.thin, overflow: 'hidden' },
  sculptureWrapper: { zIndex: 2, alignItems: 'center', justifyContent: 'center' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  glowBlob: { position: 'absolute', borderRadius: 200, zIndex: 1 },
  simContainer: { width: '100%', padding: 16, gap: 10, alignItems: 'center' },
  centeredSim: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  cinematicTask: { width: '100%', borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10, overflow: 'hidden' },
  taskContent: { flex: 1, gap: 6 },
  cinematicCheck: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  cinematicLine: { height: 6, borderRadius: 3 },
  cinematicLineShort: { height: 6, borderRadius: 3 },
  activeIndicator: { position: 'absolute', right: 12, width: 6, height: 6, borderRadius: 3, backgroundColor: '#00cc88' },
  cinematicRing: { position: 'absolute', borderWidth: 5, borderStyle: 'dashed' },
  cinematicTimer: { alignItems: 'center', gap: 12 },
  cinematicTimeText: { fontWeight: '900' },
  cinematicStats: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 2 },
  cinematicChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: '35%', width: '100%', justifyContent: 'center' },
  cinematicBar: { borderRadius: 6 },
  floatingBadge: { marginTop: 24, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18, gap: 4 },
  floatingBadgeText: { fontWeight: '900' },
  textContainer: { marginTop: 10, alignItems: 'center', gap: 8, paddingHorizontal: 10 },
  title: { fontFamily: 'Jakarta-ExtraBold', textAlign: 'center', letterSpacing: -2.5 },
  sub: { fontWeight: '500', textAlign: 'center', lineHeight: 22, paddingHorizontal: 4 },
  footer: { paddingHorizontal: 32, paddingBottom: Platform.OS === 'ios' ? 16 : 24, gap: 16 },
  indicatorContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, position: 'relative', paddingRight: 16 },
  indicator: { height: 8, borderRadius: 4 },
  nextBtn: { borderRadius: 28, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  clayShadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 15 },
  nextBtnText: { fontWeight: '900' },
});

