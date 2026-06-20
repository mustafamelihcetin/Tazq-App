import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, useWindowDimensions, Animated } from 'react-native';
import { LayoutGrid, CheckSquare, Sparkles, Layers, CalendarDays } from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../hooks/useAppTheme';
import { R } from '../constants/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const BottomNavBar = () => {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';

  const tabs = [
    { id: 'home', path: '/', icon: LayoutGrid },
    { id: 'tasks', path: '/tasks', icon: CheckSquare },
    { id: 'cockpit', path: '/cockpit', icon: CalendarDays },
    { id: 'focus', path: '/focus', icon: Sparkles },
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

  return (
    <View style={[styles.container, { bottom: Math.max(insets.bottom, 16) + 4 }]}>
      <View
        style={[
          styles.bar,
          {
            width: barWidth,
            backgroundColor: isDark ? 'rgba(15,15,18,0.88)' : 'rgba(255,255,255,0.88)',
            borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
            shadowColor: '#000',
            shadowOpacity: isDark ? 0.6 : 0.1,
          }
        ]}
      >
        <BlurView intensity={isDark ? 40 : 60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
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
              <TouchableOpacity
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
              </TouchableOpacity>
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
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 28,
    elevation: 10,
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
