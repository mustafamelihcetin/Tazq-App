import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { MotiView, MotiText, AnimatePresence } from 'moti';
import { Sparkles, Timer as TimerIcon, Play, Zap } from 'lucide-react-native';
import { useColorScheme } from 'react-native';
import { Colors } from '../constants/Colors';
import { useRouter } from 'expo-router';
import { useFocusStore } from '../store/useFocusStore';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

export const DynamicIsland = () => {
  const { width } = useWindowDimensions();
  const colorScheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const router = useRouter();
  const { isActive, seconds, currentTask } = useFocusStore();

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/focus');
  };

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mx-6 my-4"
    >
      <TouchableOpacity 
        onPress={handlePress}
        activeOpacity={0.9}
        style={[
            styles.wrapper, 
            { 
                borderColor: isActive ? theme.primary + '40' : theme.outlineVariant + '15',
                backgroundColor: theme.surfaceContainerLow,
                shadowColor: isActive ? theme.primary : '#000',
            }
        ]}
      >
        <BlurView
          intensity={Platform.OS === 'ios' ? 40 : 100}
          tint={colorScheme}
          style={styles.blurContainer}
        >
          {isActive && (
              <LinearGradient
                colors={[theme.primary + '10', 'transparent']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
          )}

          <View className="flex-row items-center flex-1">
            <MotiView 
              animate={{ 
                scale: isActive ? [1, 1.15, 1] : 1,
                rotate: isActive ? ['0deg', '15deg', '-15deg', '0deg'] : '0deg',
                backgroundColor: isActive ? theme.primary : theme.surfaceContainerHigh
              }}
              transition={{ loop: true, duration: 2500, type: 'timing' }}
              style={styles.iconCircle}
            >
              {isActive ? (
                <TimerIcon size={20} color="white" />
              ) : (
                <Sparkles size={20} color={theme.onSurfaceVariant} />
              )}
            </MotiView>

            <View className="flex-1">
              <Text style={[styles.statusText, { color: isActive ? theme.primary : theme.onSurfaceVariant }]}>
                {isActive ? 'Ongoing Focus' : 'Next Up'}
              </Text>
              <MotiText 
                key={currentTask}
                from={{ opacity: 0, translateX: -5 }}
                animate={{ opacity: 1, translateX: 0 }}
                style={[styles.taskText, { color: theme.onSurface }]} 
                numberOfLines={1}
              >
                {currentTask}
              </MotiText>
            </View>
          </View>

          <View className="flex-row items-center gap-3">
             <AnimatePresence>
                {isActive && (
                    <MotiText 
                        from={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        style={[styles.timeText, { color: theme.primary }]}
                    >
                        {formatTime(seconds)}
                    </MotiText>
                )}
             </AnimatePresence>
             <View style={[styles.badge, { backgroundColor: isActive ? theme.primary + '15' : theme.surfaceContainerHigh }]}>
                <Text style={[styles.badgeText, { color: isActive ? theme.primary : theme.onSurface }]}>
                  {isActive ? 'Live' : 'Ready'}
                </Text>
             </View>
          </View>
        </BlurView>
      </TouchableOpacity>
    </MotiView>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
  },
  blurContainer: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  statusText: {
    fontSize: 9,
    textTransform: 'uppercase',
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  taskText: {
    fontSize: 15,
    fontWeight: '800',
    paddingRight: 16,
  },
  timeText: {
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  }
});
