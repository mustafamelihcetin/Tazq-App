import React from 'react';
import { View, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LayoutGrid, Timer, Sparkles, User, ListTodo } from 'lucide-react-native';
import { useColorScheme } from 'react-native';
import { Colors } from '../constants/Colors';
import { useRouter, usePathname } from 'expo-router';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';

export const BottomNavBar = () => {
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const pathname = usePathname();

  // UX Improvement: Explicitly map internal routes and handle "placeholder" routes gracefully
  const navItems = [
    { id: 'index', icon: LayoutGrid, path: '/', label: 'Home' },
    { id: 'tasks', icon: ListTodo, path: '/tasks', label: 'Tasks' },
    { id: 'focus', icon: Sparkles, path: '/focus', label: 'Focus' },
    { id: 'settings', icon: User, path: '/login', label: 'Settings' }, // Using login as settings placeholder for now
  ];

  const handlePress = (path: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace(path as any);
  };

  // Adjust padding based on screen width
  const isSmall = width < 380;
  const containerWidth = isSmall ? '90%' : '85%';

  return (
    <View style={styles.outerContainer} className="absolute bottom-10 w-full items-center">
      <MotiView 
        from={{ translateY: 80, opacity: 0 }}
        animate={{ translateY: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, delay: 300 }}
        style={{ width: containerWidth }}
      >
        <BlurView
          intensity={Platform.OS === 'ios' ? 45 : 100}
          tint={colorScheme}
          className="rounded-[40px] flex-row justify-around items-center h-20 border border-white/20 shadow-2xl shadow-black/10"
          style={styles.container}
        >
          {navItems.map((item) => {
            const isActive = pathname === item.path || (item.path === '/' && (pathname === '/index' || pathname === '/'));
            const Icon = item.icon;

            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => handlePress(item.path)}
                className="items-center justify-center p-2"
                activeOpacity={0.8}
              >
                {isActive && (
                    <MotiView 
                        layout={Transition}
                        className="absolute inset-0 bg-primary/10 rounded-full"
                        from={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                    />
                )}
                <Icon 
                  size={24} 
                  color={isActive ? theme.primary : theme.onSurfaceVariant} 
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {isActive && (
                    <MotiView 
                        from={{ scale: 0, translateY: 4 }}
                        animate={{ scale: 1, translateY: 0 }}
                        className="w-1.5 h-1.5 rounded-full bg-primary mt-1"
                    />
                )}
              </TouchableOpacity>
            );
          })}
        </BlurView>
      </MotiView>
    </View>
  );
};

const Transition = {
  type: 'spring',
  damping: 15,
} as const;

const styles = StyleSheet.create({
  outerContainer: {
    zIndex: 1000,
  },
  container: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  }
});
