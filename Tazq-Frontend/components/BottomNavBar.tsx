import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, useWindowDimensions, Animated, Platform, Keyboard } from 'react-native';
import { LayoutGrid, CheckSquare, Sparkles, Layers, CalendarDays } from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../hooks/useAppTheme';
import { R, B } from '../constants/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Touchable } from '@/components/Touchable';

export const BottomNavBar = () => {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';

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



  const tabs = [
    { id: 'home', path: '/', icon: LayoutGrid },
    { id: 'tasks', path: '/tasks', icon: CheckSquare },
    { id: 'focus', path: '/focus', icon: Sparkles },
    { id: 'cockpit', path: '/cockpit', icon: CalendarDays },
    { id: 'modlar', path: '/modlar', icon: Layers },
  ];

  const activeIndex = tabs.findIndex(
    tab => pathname === tab.path || (tab.path === '/' && pathname === '/index')
  );

  const barWidth = width * 0.92;
  const segW = barWidth / 5;

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

  const indicatorTranslateX = indicatorSlide.interpolate({
    inputRange: [0, 1, 2, 3, 4],
    outputRange: [0, segW, segW * 2, segW * 3, segW * 4],
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
