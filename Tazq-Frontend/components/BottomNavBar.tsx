import React from 'react';
import { View, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { LayoutGrid, CheckSquare, Sparkles, User } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { useColorScheme } from 'react-native';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

export function BottomNavBar() {
  const router = useRouter();
  const segments = useSegments();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { width } = useWindowDimensions();

  const tabs = [
    { name: 'index', icon: LayoutGrid, path: '/' },
    { name: 'tasks', icon: CheckSquare, path: '/tasks' },
    { name: 'focus', icon: Sparkles, path: '/focus' },
    { name: 'profile', icon: User, path: '/profile' },
  ];

  const currentSegment = segments[segments.length - 1] || 'index';

  const handlePress = (path: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace(path as any);
  };

  return (
    <View style={styles.container}>
      <MotiView 
        from={{ translateY: 100 }}
        animate={{ translateY: 0 }}
        style={[
            styles.navBar, 
            { 
                backgroundColor: colorScheme === 'dark' ? 'rgba(45, 47, 49, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                width: width - 48,
                borderColor: theme.outlineVariant + '15'
            }
        ]}
      >
        <BlurView intensity={40} tint={colorScheme} style={StyleSheet.absoluteFill} />
        {tabs.map((tab) => {
          const isActive = (tab.name === 'index' && (currentSegment === 'index' || currentSegment === '(tabs)')) || currentSegment === tab.name;
          const Icon = tab.icon;

          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => handlePress(tab.path)}
              style={styles.tab}
              activeOpacity={0.7}
            >
              <MotiView
                animate={{
                  scale: isActive ? 1.1 : 1,
                  backgroundColor: isActive ? theme.primary : 'transparent',
                }}
                style={[
                    styles.iconWrapper,
                    isActive && { shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 }
                ]}
              >
                <Icon
                  size={24}
                  color={isActive ? 'white' : theme.onSurfaceVariant}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </MotiView>
              {isActive && (
                <MotiView 
                  layout={Platform.OS === 'ios' ? undefined : undefined}
                  from={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  style={[styles.activeDot, { backgroundColor: theme.primary }]} 
                />
              )}
            </TouchableOpacity>
          );
        })}
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 32,
    zIndex: 1000,
  },
  navBar: {
    flexDirection: 'row',
    height: 72,
    borderRadius: 36,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  tab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    bottom: 8,
  }
});
