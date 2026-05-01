import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  useWindowDimensions, 
  ScrollView,
  NativeSyntheticEvent, 
  NativeScrollEvent,
  DimensionValue,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView, MotiText } from 'moti';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../hooks/useAppTheme';
import { useLanguageStore } from '../store/useLanguageStore';
import { ChevronRight, CheckCircle2, Clock, Zap, TrendingUp, Sparkles, Activity, ListTodo } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Easing } from 'react-native-reanimated';

const SLIDES = [
  {
    id: '1',
    titleKey: 'onboardingTitle1',
    bodyKey: 'onboardingBody1',
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDehFy7-IfGX-n56BKeKMDpeteacGPRXtHDqUo6-zbjYc-PMuxAXBqev3oaYKuX_mNapLCAvQw2CkTsFLjwC_DbU6sROn3H741ruPT_vckOM7Gv4mZ6Iunnzm5oCmF4tnTCFvMkOXzH1j-6bN8DwNqDzgWXFdL04TwjPSHHAufe66HWcDnQMMyK8NnFLO0g4Lt8XkuIVNA9tE1e7fBJV_1ZB1PORiaxcc29_kywNIxLlTWoCAkmG_14hMNExtlni_lkrZeiFOlSvaA",
    color: '#3367ff',
    type: 'sculpture'
  },
  {
    id: '2',
    titleKey: 'onboardingTitle2',
    bodyKey: 'onboardingBody2',
    color: '#00cc88',
    type: 'tasks'
  },
  {
    id: '3',
    titleKey: 'onboardingTitle3',
    bodyKey: 'onboardingBody3',
    color: '#ff2d55',
    type: 'focus'
  },
  {
    id: '4',
    titleKey: 'Akıllı Analiz',
    bodyKey: 'Verimliliğin her adımda ölçülür ve optimize edilir.',
    color: '#6200ee',
    type: 'stats'
  },
  {
    id: '5',
    titleKey: 'Yarın Başlıyor',
    bodyKey: 'Yeni nesil yüksek performanslı araçlara katılın.',
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuALtdMkm7GYoNuakWzR99utIollrCJCVYOVV7c8JNAoHwp9uNli3FD1KZwlWraR1nRMvilIe-qxN2KuSCZNFYDWqcUISH7B2R4kiojmpebKJD0XYYaADkTgBoGQcaTXSnXK-6XPzhkkLcy8eng_Lu8tesOVYNdsIbmy5GqcjgRWJI1S0sKVVBWe5tz8yp4uuGpQvgYlbdTEZ4DtkkChqy_dsrgTkm95MVd5xQoakNHkXgMaC054Ev0UGZUeqT_s464oEIdYfUO_Bck",
    color: '#ff9500',
    type: 'sculpture'
  }
];

export default function OnboardingScreen() {
  const { theme, isDark } = useAppTheme();
  const { t } = useLanguageStore();
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
      case 'sculpture':
        return (
          <View style={[styles.visualCard, { width: visualSize, height: visualSize }]}>
            <MotiView 
                animate={{ scale: isActive ? 1 : 0.9, opacity: isActive ? 1 : 0.01 }}
                transition={{ type: 'timing', duration: 800 }}
                style={styles.sculptureWrapper}
            >
                <MotiView 
                    animate={{ translateY: isActive ? [0, -10, 0] : 0 }}
                    transition={{ loop: true, duration: 6000, easing: Easing.inOut(Easing.sin) }}
                    style={{ width: visualSize, height: visualSize }}
                >
                    {item.image ? (
                        <Image 
                            source={{ uri: item.image }} 
                            style={{ width: '100%', height: '100%', borderRadius: visualSize / 5 }} 
                            resizeMode="cover" 
                        />
                    ) : (
                        <View style={styles.fallback}>
                            <Sparkles size={visualSize * 0.3} color={item.color} />
                        </View>
                    )}
                </MotiView>
            </MotiView>
            <MotiView 
                animate={{ scale: isActive ? [1, 1.25, 1.1] : 0.8, opacity: isActive ? 0.1 : 0 }}
                transition={{ loop: true, duration: 6000 }}
                style={[styles.glowBlob, { backgroundColor: item.color, width: visualSize, height: visualSize }]}
            />
          </View>
        );
      case 'tasks':
        return (
          <View style={[styles.visualCard, styles.withFrame, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.outlineVariant, width: visualSize, height: visualSize }]}>
            <View style={styles.simContainer}>
                {[0, 1, 2].map((i) => (
                    <MotiView 
                        key={i}
                        animate={{ translateX: isActive ? 0 : 40, opacity: isActive ? 1 : 0 }}
                        transition={{ delay: 300 + (i * 150), type: 'spring' }}
                        style={[styles.cinematicTask, { backgroundColor: theme.surfaceContainerHighest, height: isSmallDevice ? 38 : 52 }]}
                    >
                        <MotiView 
                            animate={{ 
                                scale: (isActive && i === 0) ? [1, 1.2, 1] : 1, 
                                backgroundColor: (isActive && i === 0) ? theme.primary : 'transparent' 
                            }}
                            transition={{ delay: 2000 }}
                            style={[styles.cinematicCheck, { borderColor: theme.primary }]}
                        >
                           {i === 0 && isActive && <CheckCircle2 size={12} color="white" />}
                        </MotiView>
                        <View style={styles.taskContent}>
                            <View style={[styles.cinematicLine, { backgroundColor: theme.outlineVariant, width: i === 1 ? '70%' : '50%' }]} />
                            <View style={[styles.cinematicLineShort, { backgroundColor: theme.outlineVariant, width: i === 0 ? '40%' : '30%' }]} />
                        </View>
                        {i === 0 && (
                            <MotiView 
                                animate={{ opacity: isActive ? [0, 1, 0] : 0 }}
                                transition={{ loop: true, duration: 2000 }}
                                style={styles.activeIndicator}
                            />
                        )}
                    </MotiView>
                ))}
            </View>
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
                    {`24:${(59 - timerSeconds).toString().padStart(2, '0')}`}
                </Text>
             </View>
          </View>
        );
      case 'stats':
        return (
          <View style={[styles.visualCard, styles.withFrame, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.outlineVariant, width: visualSize, height: visualSize }]}>
            <View style={styles.centeredSim}>
                <View style={styles.cinematicChart}>
                    {[40, 75, 50, 100, 65].map((h, i) => (
                        <MotiView 
                            key={i}
                            animate={{ height: isActive ? (`${h}%` as DimensionValue) : ('10%' as DimensionValue) }}
                            transition={{ delay: 400 + (i * 100), type: 'spring' }}
                            style={[styles.cinematicBar, { backgroundColor: theme.primary, width: isSmallDevice ? 10 : 16 }]}
                        />
                    ))}
                </View>
                <MotiView 
                    animate={{ scale: isActive ? 1 : 0, translateY: isActive ? 0 : 10 }}
                    transition={{ delay: 1500, type: 'spring' }}
                    style={[styles.floatingBadge, { backgroundColor: theme.secondaryContainer }]}
                >
                    <Activity size={14} color={theme.onSecondary} />
                    <Text style={[styles.floatingBadgeText, { color: theme.onSecondary, fontSize: 12 }]}>Peak Focus</Text>
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
            <TouchableOpacity onPress={() => router.push('/login')} style={styles.skipBtn}>
                <Text style={[styles.skipText, { color: theme.onSurfaceVariant }]}>{t.skip}</Text>
            </TouchableOpacity>
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
                    width: currentIndex === index ? 32 : 8,
                    backgroundColor: currentIndex === index ? theme.primary : theme.outlineVariant 
                }}
                style={styles.indicator}
              />
            ))}
          </View>

          <TouchableOpacity 
            onPress={nextSlide} 
            activeOpacity={0.8} 
            style={[styles.nextBtn, { backgroundColor: theme.primary, height: isSmallDevice ? 56 : 64 }, !isDark && styles.clayShadow]}
          >
             <Text style={[styles.nextBtnText, { color: theme.onPrimary, fontSize: isSmallDevice ? 16 : 18 }]}>
                {currentIndex === SLIDES.length - 1 ? t.welcome.getStarted : t.next}
             </Text>
             <ChevronRight size={20} color={theme.onPrimary} strokeWidth={3} />
          </TouchableOpacity>
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
  withFrame: { borderRadius: 40, borderWidth: 1, overflow: 'hidden' },
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
  indicatorContainer: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  indicator: { height: 8, borderRadius: 4 },
  nextBtn: { borderRadius: 28, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  clayShadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 15 },
  nextBtnText: { fontWeight: '900' },
});
