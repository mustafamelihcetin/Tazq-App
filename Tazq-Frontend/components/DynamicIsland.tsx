import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { MotiView, MotiText, AnimatePresence } from 'moti';
import { Sparkles, Timer as TimerIcon, Play } from 'lucide-react-native';
import { useColorScheme } from 'react-native';
import { Colors } from '../constants/Colors';
import { useRouter } from 'expo-router';
import { useFocusStore } from '../store/useFocusStore';
import * as Haptics from 'expo-haptics';

export const DynamicIsland = () => {
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
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
      className="mx-6 my-4"
    >
      <TouchableOpacity 
        onPress={handlePress}
        activeOpacity={0.9}
        className="rounded-[40px] overflow-hidden shadow-2xl shadow-black/10 border border-white/20"
      >
        <BlurView
          intensity={Platform.OS === 'ios' ? 40 : 100}
          tint={colorScheme}
          className="px-6 py-4 flex-row items-center justify-between"
          style={styles.container}
        >
          <View className="flex-row items-center flex-1">
            <MotiView 
              animate={{ 
                scale: isActive ? [1, 1.1, 1] : 1,
                rotate: isActive ? ['0deg', '10deg', '-10deg', '0deg'] : '0deg'
              }}
              transition={{ loop: true, duration: 2000 }}
              className={`w-10 h-10 rounded-full items-center justify-center mr-4 ${isActive ? 'bg-primary' : 'bg-surface-container-high'}`}
            >
              {isActive ? (
                <TimerIcon size={20} color="white" />
              ) : (
                <Sparkles size={20} color={theme.onSurfaceVariant} />
              )}
            </MotiView>

            <View className="flex-1">
              <Text className="text-[10px] uppercase font-black tracking-widest" style={{ color: isActive ? theme.primary : theme.onSurfaceVariant }}>
                {isActive ? 'Ongoing Focus' : 'Next Up'}
              </Text>
              <Text className="text-sm font-bold pr-4" numberOfLines={1} style={{ color: theme.onSurface }}>
                {currentTask}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-3">
             {isActive && (
                 <MotiText 
                    style={{ color: theme.primary }} 
                    className="font-black tabular-nums text-sm"
                 >
                    {formatTime(seconds)}
                 </MotiText>
             )}
             <View className="bg-surface-container-high px-3 py-1.5 rounded-full">
                <Text className="text-[10px] font-black" style={{ color: theme.onSurface }}>
                  {isActive ? 'Live' : 'Ready'}
                </Text>
             </View>
          </View>
        </BlurView>
      </TouchableOpacity>
    </MotiView>
  );
};

const Transition = {
  type: 'spring',
  damping: 18,
} as const;

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  }
});
