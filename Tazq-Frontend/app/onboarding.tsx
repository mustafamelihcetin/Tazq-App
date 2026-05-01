import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Colors } from '../constants/Colors';
import { useColorScheme } from 'react-native';
import { useLanguageStore } from '../store/useLanguageStore';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Target, Sparkles, TrendingUp } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const SLIDES = [
  { icon: Target, colorKey: 'primary' as const, titleKey: 'onboardingTitle1' as const, bodyKey: 'onboardingBody1' as const },
  { icon: Sparkles, colorKey: 'tertiary' as const, titleKey: 'onboardingTitle2' as const, bodyKey: 'onboardingBody2' as const },
  { icon: TrendingUp, colorKey: 'secondary' as const, titleKey: 'onboardingTitle3' as const, bodyKey: 'onboardingBody3' as const },
];

export default function OnboardingScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { t } = useLanguageStore();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const finish = async () => {
    await AsyncStorage.setItem('tazq-onboarding-done', '1');
    router.replace('/login');
  };

  const next = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (index < SLIDES.length - 1) {
      const nextIndex = index + 1;
      setIndex(nextIndex);
      scrollRef.current?.scrollTo({ x: nextIndex * width, animated: true });
    } else {
      finish();
    }
  };

  const skip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    finish();
  };

  const slide = SLIDES[index];
  const Icon = slide.icon;
  const color = theme[slide.colorKey];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Skip */}
        <View style={styles.topRow}>
          <TouchableOpacity onPress={skip}>
            <Text style={[styles.skipText, { color: theme.onSurfaceVariant }]}>{t.skip}</Text>
          </TouchableOpacity>
        </View>

        {/* Slide area (horizontal scroll, programmatically driven) */}
        <ScrollView ref={scrollRef} horizontal pagingEnabled scrollEnabled={false}
          showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          {SLIDES.map((s, i) => {
            const SIcon = s.icon;
            const sColor = theme[s.colorKey];
            return (
              <View key={i} style={[styles.slide, { width }]}>
                <MotiView
                  key={`icon-${i}-${index}`}
                  from={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 15 }}
                  style={[styles.iconContainer, { backgroundColor: sColor + '15' }]}
                >
                  <SIcon size={64} color={sColor} />
                </MotiView>
                <MotiView
                  from={{ opacity: 0, translateY: 20 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ delay: 200 }}
                >
                  <Text style={[styles.title, { color: theme.onSurface }]}>{t[s.titleKey]}</Text>
                  <Text style={[styles.body, { color: theme.onSurfaceVariant }]}>{t[s.bodyKey]}</Text>
                </MotiView>
              </View>
            );
          })}
        </ScrollView>

        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <MotiView key={i}
              animate={{ width: i === index ? 24 : 8, backgroundColor: i === index ? color : theme.outlineVariant + '60' }}
              transition={{ type: 'timing', duration: 250 }}
              style={styles.dot}
            />
          ))}
        </View>

        {/* Button */}
        <View style={styles.btnContainer}>
          <TouchableOpacity onPress={next}
            style={[styles.btn, { backgroundColor: color }]}>
            <Text style={styles.btnText}>
              {index === SLIDES.length - 1 ? t.getStarted : t.next}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { paddingHorizontal: 24, paddingTop: 8, alignItems: 'flex-end' },
  skipText: { fontSize: 14, fontWeight: '600' },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  iconContainer: { width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center', marginBottom: 48 },
  title: { fontSize: 32, fontWeight: '900', letterSpacing: -1, textAlign: 'center', lineHeight: 38 },
  body: { fontSize: 16, textAlign: 'center', marginTop: 16, lineHeight: 24, fontWeight: '400' },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 24 },
  dot: { height: 8, borderRadius: 4 },
  btnContainer: { paddingHorizontal: 24, paddingBottom: 16 },
  btn: { borderRadius: 100, padding: 18, alignItems: 'center' },
  btnText: { color: 'white', fontSize: 16, fontWeight: '900' },
});
