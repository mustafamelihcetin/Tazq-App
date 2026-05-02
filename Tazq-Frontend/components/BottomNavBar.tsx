import React from 'react';
import { View, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { LayoutGrid, CheckSquare, Sparkles, User } from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../hooks/useAppTheme';
import { R } from '../constants/tokens';

export const BottomNavBar = () => {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const router = useRouter();
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';

  const tabs = [
    { id: 'home', path: '/', icon: LayoutGrid },
    { id: 'tasks', path: '/tasks', icon: CheckSquare },
    { id: 'focus', path: '/focus', icon: Sparkles },
    { id: 'profile', path: '/profile', icon: User },
  ];

  const handlePress = (path: string) => {
    if (pathname === path) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace(path as any);
  };

  return (
    <View style={styles.container}>
      <MotiView
        from={{ translateY: 100 }}
        animate={{ translateY: 0 }}
        transition={{ type: 'spring', damping: 20 }}
        style={[
          styles.bar,
          {
            width: width * 0.88,
            backgroundColor: isDark ? 'rgba(15,15,18,0.88)' : 'rgba(255,255,255,0.88)',
            borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
            shadowColor: '#000',
            shadowOpacity: isDark ? 0.6 : 0.1,
          }
        ]}
      >
        <BlurView intensity={isDark ? 40 : 60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={styles.tabsContainer}>
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
                {isActive && (
                  <MotiView
                    from={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', damping: 18 }}
                    style={[styles.activeIndicator, { backgroundColor: theme.primary + '18' }]}
                  />
                )}
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
      </MotiView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 28,
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
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tab: {
    width: 56,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    position: 'absolute',
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
