import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, useWindowDimensions, Animated, Platform, Keyboard } from 'react-native';
import { LayoutGrid, CheckSquare, Sparkles, Layers, CalendarDays } from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { R, B, MAX_W } from '@/shared/constants/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Touchable } from '@/shared/components/Touchable';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';

// Lite modda gösterilecek sekmeler (sade to-do deneyimi). Pro'da hepsi görünür.
const LITE_TAB_IDS = ['home', 'tasks', 'focus'];

// Ekran okuyucu (VoiceOver/TalkBack) için sekme etiketleri
const TAB_LABELS: Record<string, { tr: string; en: string }> = {
  home: { tr: 'Ana Sayfa', en: 'Home' },
  tasks: { tr: 'Görevler', en: 'Tasks' },
  focus: { tr: 'Odak', en: 'Focus' },
  cockpit: { tr: 'Haftalık Merkez', en: 'Weekly Hub' },
  modlar: { tr: 'Modlar', en: 'Modes' },
};

export const BottomNavBar = () => {
  const { width } = useWindowDimensions();
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

  const activeIndex = tabs.findIndex(
    tab => pathname === tab.path || (tab.path === '/' && pathname === '/index')
  );

  const barWidth = Math.min(width * 0.92, MAX_W);
  const segW = barWidth / tabs.length;

  const indicatorSlide = useRef(new Animated.Value(activeIndex >= 0 ? activeIndex : 0)).current;

  useEffect(() => {
    if (activeIndex >= 0) {
      Animated.spring(indicatorSlide, {
        toValue: activeIndex,
        useNativeDriver: true,
        damping: 20,
        stiffness: 220,
      } as any).start();
    }
  }, [activeIndex]);

  // Sekme sayısına göre dinamik gösterge konumu (Lite/Pro sekme sayısı değişebilir)
  const indicatorTranslateX = indicatorSlide.interpolate({
    inputRange: tabs.map((_, i) => i),
    outputRange: tabs.map((_, i) => segW * i),
  });

  const handlePress = (path: string) => {
    if (pathname === path) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace(path as any);
  };

  if (keyboardVisible && Platform.OS === 'android') {
    return null;
  }

  return (
    <View style={[styles.container, { bottom: Math.max(insets.bottom, 16) + 4 }]}>
      <View
        style={[
          styles.bar,
          {
            width: barWidth,
            backgroundColor: isDark ? 'rgba(15,15,18,0.95)' : 'rgba(255,255,255,0.95)',
            borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
            ...(Platform.OS === 'ios' ? {
              shadowColor: '#000',
              shadowOpacity: isDark ? 0.4 : 0.1,
            } : {}),
          }
        ]}
      >
        {Platform.OS === 'ios' && (
          <BlurView intensity={isDark ? 40 : 60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        )}
        <View style={styles.tabsContainer}>
          {/* Sliding active indicator */}
          {activeIndex >= 0 && (
            <Animated.View
              style={[
                styles.activeIndicator,
                {
                  backgroundColor: theme.primary + '18',
                  position: 'absolute',
                  // Each tab is flex:1 → exactly segW wide. Center = segW/2. Half indicator = 24.
                  left: segW / 2 - 24,
                  top: '50%',
                  marginTop: -24,
                  transform: [{ translateX: indicatorTranslateX }],
                }
              ]}
            />
          )}
          {tabs.map((tab) => {
            const isActive = pathname === tab.path || (tab.path === '/' && pathname === '/index');
            const Icon = tab.icon;
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
                <Icon
                  size={22}
                  color={isActive ? theme.primary : theme.onSurfaceVariant}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                {isActive && (
                  <MotiView
                    from={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    style={[styles.dot, { backgroundColor: theme.primary }]}
                  />
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
    alignItems: 'center',
    zIndex: 1000,
  },
  bar: {
    height: 68,
    borderRadius: R.full,
    borderWidth: B.thin,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 28,
    elevation: 0,
  },
  tabsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    width: 48,
    height: 48,
    borderRadius: R.full,
  },
  dot: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
