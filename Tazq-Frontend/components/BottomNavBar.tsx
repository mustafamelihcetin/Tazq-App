import React from 'react';
import { View, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { LayoutGrid, CheckSquare, Sparkles, User } from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../hooks/useAppTheme';

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
        style={[
            styles.bar,
            {
                width: width * 0.9,
                backgroundColor: isDark ? 'rgba(26,26,26,0.85)' : 'rgba(255,255,255,0.85)',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                shadowColor: '#000',
                shadowOpacity: isDark ? 0.5 : 0.1,
            }
        ]}
      >
        <BlurView intensity={isDark ? 30 : 50} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        
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
                        from={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={[styles.activeIndicator, { backgroundColor: theme.primary + '15' }]}
                    />
                )}
                <Icon 
                    size={24} 
                    color={isActive ? theme.primary : theme.onSurfaceVariant} 
                    strokeWidth={isActive ? 2.5 : 2}
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
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  bar: {
    height: 72,
    borderRadius: 36,
    borderWidth: 1.2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 15 },
    shadowRadius: 30,
    elevation: 10,
  },
  tabsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
  },
  tab: {
    width: 60,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  dot: {
    position: 'absolute',
    bottom: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
  }
});
