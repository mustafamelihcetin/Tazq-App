import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView, MotiText, AnimatePresence } from 'moti';
import { BlurView } from 'expo-blur';
import { X, Pause, Play, Sparkles, Timer as TimerIcon } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusStore } from '../store/useFocusStore';
import * as Haptics from 'expo-haptics';

export default function FocusScreen() {
  const { width, height } = useWindowDimensions();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  
  const { isActive, seconds, currentTask, setIsActive, setSeconds } = useFocusStore();

  useEffect(() => {
    let interval: any = null;
    if (isActive && seconds > 0) {
      interval = setInterval(() => {
        setSeconds((s) => s - 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, seconds]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleFocus = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsActive(!isActive);
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  // Responsive scale
  const timerSize = width * 0.75;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Ambient Glows */}
      <MotiView 
        animate={{ 
            scale: isActive ? [1, 1.2, 1] : 1,
            opacity: isActive ? 0.4 : 0.2
        }}
        transition={{ loop: true, duration: 4000 }}
        style={[styles.ambientOrb, { backgroundColor: theme.primary, top: -100, right: -100 }]}
      />
      
      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="px-8 py-6 flex-row justify-between items-center">
          <TouchableOpacity 
            onPress={handleClose}
            className="w-12 h-12 rounded-full bg-white/5 items-center justify-center border border-white/10"
          >
            <X size={24} color={theme.onSurface} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text className="text-xl font-black tracking-tighter" style={{ color: theme.primary }}>TAZQ</Text>
          <View className="w-12 h-12" />
        </View>

        <View className="flex-1 items-center justify-center -mt-10 px-8">
          {/* Focus Headline */}
          <MotiView 
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            className="items-center mb-16"
          >
            <View className="bg-primary/10 px-4 py-1.5 rounded-full mb-4 flex-row items-center gap-2">
                <Sparkles size={14} color={theme.primary} />
                <Text className="text-[10px] font-black uppercase tracking-widest" style={{ color: theme.primary }}>FOCUSING ON</Text>
            </View>
            <Text className="text-4xl font-black text-center tracking-tighter" style={{ color: theme.onSurface }}>
              {currentTask}
            </Text>
          </MotiView>

          {/* 3D Timer - Claymorphic Bubble */}
          <MotiView
            animate={{ 
                scale: isActive ? [1, 1.02, 1] : 1,
            }}
            transition={{ loop: true, duration: 3000 }}
            className="relative items-center justify-center"
          >
            <View 
                style={[styles.timerBubble, { width: timerSize, height: timerSize, borderRadius: timerSize / 2 }]} 
                className="bg-surface-container shadow-2xl items-center justify-center"
            >
                {/* Decorative Rings */}
                <View className="absolute inset-4 rounded-full border border-white/10" />
                <View className="absolute inset-8 rounded-full border border-white/5" />

                {/* Main Time Display */}
                <MotiText 
                    className="text-7xl font-black tracking-tighter"
                    style={{ color: theme.primary }}
                >
                    {formatTime(seconds)}
                </MotiText>
                
                <AnimatePresence>
                    {isActive && (
                        <MotiView 
                            from={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0 }}
                            className="absolute -bottom-2 bg-primary px-4 py-1.5 rounded-full"
                        >
                            <Text className="text-white text-[10px] font-black uppercase tracking-widest">Live session</Text>
                        </MotiView>
                    )}
                </AnimatePresence>
            </View>
          </MotiView>

          {/* Controls */}
          <View className="mt-20 flex-row items-center gap-10">
             <TouchableOpacity 
                onPress={toggleFocus}
                activeOpacity={0.9}
                style={[styles.playButton, { backgroundColor: isActive ? theme.secondary : theme.primary }]}
                className="w-24 h-24 rounded-full items-center justify-center shadow-xl"
             >
                <LinearGradient
                    colors={['rgba(255,255,255,0.2)', 'transparent']}
                    className="absolute inset-0 rounded-full"
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />
                {isActive ? 
                    <Pause size={36} color="white" fill="white" /> : 
                    <Play size={36} color="white" fill="white" style={{ marginLeft: 4 }} />
                }
             </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  timerBubble: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.1,
    shadowRadius: 50,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  playButton: {
    shadowColor: '#0058bb',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  ambientOrb: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    filter: Platform.OS === 'ios' ? undefined : 'blur(60px)', // Android doesn't support blur on View
  }
});
