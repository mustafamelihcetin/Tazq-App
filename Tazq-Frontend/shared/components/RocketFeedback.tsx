import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import { useMomentumStore } from '@/features/user/store/useMomentumStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import * as Haptics from 'expo-haptics';
import { Rocket, Flame, Zap, Layers, Sparkles } from 'lucide-react-native';
import { usePathname } from 'expo-router';
import { F, S, R } from '@/shared/constants/tokens';

export const RocketFeedback: React.FC = () => {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  
  const { 
    showRocketFeedback, 
    engineHeat, 
    isOverheated, 
    isPerfectSync,
    isBatchConfirming,
    dismissRocketFeedback 
  } = useMomentumStore();

  const uiMode = usePrefsStore(s => s.uiMode);
  const { language } = useLanguageStore();
  const isLite = uiMode === 'lite';
  const tr = language === 'tr';
  const pathname = usePathname();

  const slideAnim = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isLite) return;

    if (showRocketFeedback) {
      if (pathname !== '/') {
        dismissRocketFeedback();
        return;
      }

      setVisible(true);
      Haptics.notificationAsync(
        isOverheated 
          ? Haptics.NotificationFeedbackType.Warning 
          : Haptics.NotificationFeedbackType.Success
      ).catch(() => {});

      Animated.spring(slideAnim, {
        toValue: 1,
        tension: 60,
        friction: 9,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        dismissRocketFeedback();
      }, 4500);

      return () => clearTimeout(timer);
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
      });
    }
  }, [showRocketFeedback, isLite, isOverheated]);

  if (isLite || !visible) return null;

  const roundedHeat = Math.round(engineHeat);

  // Elegant, system-matching color system (perfectly readable on both Light & Dark modes)
  const bubbleStyles = (() => {
    if (isOverheated) {
      return {
        bg: isDark ? '#2D161B' : '#FFF5F5',
        border: isDark ? '#FF453A' : '#FF3B30',
        text: isDark ? 'rgba(255,255,255,0.9)' : '#2C1A1E',
        subtext: isDark ? 'rgba(255,149,0,0.85)' : '#D32F2F',
        title: isDark ? '#FF453A' : '#D32F2F',
        badgeBg: isDark ? '#FF453A22' : '#FF3B3015',
      };
    }
    if (isBatchConfirming) {
      return {
        bg: isDark ? '#251A30' : '#F9F5FF',
        border: isDark ? '#AF52DE' : '#9F40DE',
        text: isDark ? 'rgba(255,255,255,0.9)' : '#2B1A3C',
        subtext: isDark ? 'rgba(255,255,255,0.6)' : '#8F7EA6',
        title: isDark ? '#BF5AF2' : '#8A2BE2',
        badgeBg: isDark ? '#AF52DE22' : '#AF52DE15',
      };
    }
    if (isPerfectSync) {
      return {
        bg: isDark ? '#1C1C1E' : '#F4FCFF',
        border: isDark ? '#00E5FF' : '#00B0FF',
        text: isDark ? 'rgba(255,255,255,0.9)' : '#1C1C1E',
        subtext: isDark ? 'rgba(255,255,255,0.6)' : '#8E8E93',
        title: isDark ? '#00E5FF' : '#0091EA',
        badgeBg: isDark ? '#00E5FF22' : '#00B0FF15',
      };
    }
    const isHighHeat = roundedHeat > 50;
    if (isHighHeat) {
      return {
        bg: isDark ? '#1C1C1E' : '#FFFBF4',
        border: isDark ? '#FF9F0A' : '#FF9500',
        text: isDark ? 'rgba(255,255,255,0.9)' : '#2C221A',
        subtext: isDark ? 'rgba(255,255,255,0.6)' : '#8E8E93',
        title: isDark ? '#FF9F0A' : '#B25E00',
        badgeBg: isDark ? '#FF9F0A22' : '#FF950015',
      };
    }
    return {
      bg: isDark ? '#1C1C1E' : '#FFFFFF',
      border: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
      text: isDark ? 'rgba(255,255,255,0.9)' : '#1C1C1E',
      subtext: isDark ? 'rgba(255,255,255,0.6)' : '#8E8E93',
      title: isDark ? '#0A84FF' : '#007AFF',
      badgeBg: isDark ? 'rgba(10,132,255,0.15)' : 'rgba(0,122,255,0.08)',
    };
  })();

  // Multi-state headers
  const isHighHeat = roundedHeat > 50;
  const statusText = isOverheated 
    ? (tr ? 'MOTOR KİLİTLENDİ ❌' : 'ENGINE LOCKED ❌')
    : isBatchConfirming
      ? (tr ? 'TOPLU ONAYLAMA 📥' : 'BATCH COMPLETION 📥')
      : isPerfectSync
        ? (tr ? 'KUSURSUZ SENKRON 🌟' : 'PERFECT SYNC 🌟')
        : (isHighHeat 
            ? (tr ? 'MOTOR ISINIYOR 🌋' : 'ENGINE WARMING 🌋')
            : (tr ? 'İVME ATEŞLENDİ 🚀' : 'BOOSTER FIRED 🚀'));

  // Clear, readable explanations of tasks completion logic
  const descText = isOverheated
    ? (tr 
        ? 'İvme motoru kilitlendi! Çok hızlı ardışık tamamlama yapıldı. Birikmiş kalkan hakkı sıfırlandı.' 
        : 'Thrusters locked! Rapid task completion detected. Unbanked shield progress reset.')
    : isBatchConfirming
      ? (tr
          ? 'Unutulan görevleri toplu onayladığınızı fark ettik. Motor aşırı ısınması askıya alındı.'
          : 'We noticed you are bulk-checking forgotten tasks. Overheating has been suspended.')
      : isPerfectSync
        ? (tr
            ? 'Mükemmel zamanlama! Görevi tamamladığın an gerçek zamanlı işaretledin.'
            : 'Perfect timing! You checked off the task exactly when done.')
        : (tr 
            ? `Tazq Roketi ateşlendi, ivme kazanımı aktif.` 
            : `Tazq Rocket fired, momentum thruster is active.`);

  // Why wait description
  const waitExplanation = isOverheated
    ? (tr 
        ? '💡 İvme puanı doğruluğu için görevlerinizi gün içinde gerçekleştikçe gerçek zamanlı işaretleyin.' 
        : '💡 Check off tasks in real-time as you complete them to track score accurately.')
    : isBatchConfirming
      ? (tr
          ? 'İvmeniz korunuyor. Görevleri zamanında işaretlemek en iyisidir.'
          : 'Your momentum is preserved. It is best to check off tasks in real-time.')
      : (tr 
          ? `Motor Sıcaklığı: %${roundedHeat}. İvmeniz besleniyor.` 
          : `Thruster Temp: ${roundedHeat}%. Your momentum score is rising.`);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [120, 0],
  });

  const opacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const flameColor = isOverheated 
    ? '#FF1744' 
    : isBatchConfirming
      ? '#AF52DE'
      : (isHighHeat ? '#FF9100' : '#00E5FF');

  const IconComponent = (() => {
    if (isOverheated) return Flame;
    if (isBatchConfirming) return Layers;
    if (isPerfectSync) return Zap;
    if (isHighHeat) return Flame;
    return Rocket;
  })();

  return (
    <View style={styles.outerContainer} pointerEvents="none">
      <Animated.View
        style={[
          styles.layoutWrapper,
          {
            opacity,
            transform: [{ translateY }],
          }
        ]}
      >
        {/* Mascot Container (Floats on the left, decoupled layout) */}
        <View style={styles.mascotContainer}>
          <View style={[styles.viewportBackdrop, { borderColor: flameColor + '40', shadowColor: flameColor, shadowOpacity: 0.4, shadowRadius: 8 }]} />
          <IconComponent size={24} color={flameColor} />
        </View>

        {/* Speech Bubble Container */}
        <View style={[styles.bubble, { backgroundColor: bubbleStyles.bg, borderColor: bubbleStyles.border }]}>
          <View style={[
            styles.pointer, 
            { 
              backgroundColor: bubbleStyles.bg, 
              borderLeftWidth: 1.2,
              borderTopWidth: 1.2,
              borderColor: bubbleStyles.border 
            }
          ]} />
          
          <View style={styles.textContainer}>
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: bubbleStyles.title }]}>
                {statusText}
              </Text>
              
              <View style={[styles.badge, { backgroundColor: bubbleStyles.badgeBg, borderColor: bubbleStyles.border + '40' }]}>
                <Text style={[styles.badgeText, { color: bubbleStyles.title }]}>
                  {roundedHeat}°C
                </Text>
              </View>
            </View>
            
            <Text style={[styles.body, { color: bubbleStyles.text }]}>
              {descText}
            </Text>
            
            <Text style={[styles.subtext, { color: bubbleStyles.subtext }]}>
              {waitExplanation}
            </Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 108, // Lifted safely above the bottom navigation tabs
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  layoutWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: Dimensions.get('window').width - 24,
  },
  mascotContainer: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  viewportBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: R.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  bubble: {
    flex: 1,
    marginLeft: S.smd,
    paddingHorizontal: S.md,
    paddingVertical: S.smd,
    borderRadius: R.xl,
    borderWidth: 1.2,
    position: 'relative',
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  pointer: {
    position: 'absolute',
    left: -7,
    top: 21,
    width: 12,
    height: 12,
    transform: [{ rotate: '45deg' }],
    zIndex: 10,
  },
  textContainer: {
    flex: 1,
    gap: S.xs,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: S.xxs,
  },
  title: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  badge: {
    paddingHorizontal: S.sm,
    paddingVertical: S.xxs,
    borderRadius: R.sm,
    borderWidth: 0.5,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '700',
  },
  body: {
    fontSize: F.caption2,
    fontWeight: '700',
    lineHeight: 16,
  },
  subtext: {
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 14,
    marginTop: S.xxs,
  }
});
