import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';
import { Play, Pause, RotateCcw, X, Sparkles, Zap } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguageStore } from '../store/useLanguageStore';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

export default function FocusScreen() {
  const [seconds, setSeconds] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { t } = useLanguageStore();

  useEffect(() => {
    let interval: any = null;
    if (isActive && seconds > 0) {
      interval = setInterval(() => {
        setSeconds((seconds) => seconds - 1);
      }, 1000);
    } else if (seconds === 0) {
      setIsActive(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    return () => clearInterval(interval);
  }, [isActive, seconds]);

  const toggleTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsActive(false);
    setSeconds(25 * 60);
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
            <TouchableOpacity 
                onPress={() => router.back()}
                style={[styles.closeBtn, { backgroundColor: theme.surfaceContainerLow }]}
            >
                <X size={24} color={theme.onSurface} />
            </TouchableOpacity>
            <View style={[styles.badge, { backgroundColor: theme.tertiary + '15' }]}>
                <Sparkles size={14} color={theme.tertiary} />
                <Text style={[styles.badgeText, { color: theme.tertiary }]}>DEEP FOCUS</Text>
            </View>
        </View>

        <View style={styles.content}>
            {/* Sophisticated Timer Circle */}
            <MotiView 
                animate={{ 
                    scale: isActive ? 1.05 : 1,
                    rotate: isActive ? '2deg' : '0deg'
                }}
                transition={{ type: 'timing', duration: 2000, loop: true }}
                style={[styles.timerOuter, { borderColor: theme.primary + '10' }]}
            >
                <View style={[styles.timerInner, { backgroundColor: theme.surfaceContainerLowest, shadowColor: theme.primary }]}>
                    <Text style={[styles.timerText, { color: theme.primary }]}>
                        {formatTime(seconds)}
                    </Text>
                    <Text style={[styles.taskLabel, { color: theme.onSurfaceVariant }]}>Design System Porting</Text>
                </View>
                
                {/* Decorative Elements */}
                <View style={[styles.decoCircle, { backgroundColor: theme.secondary + '10', top: -20, right: -20 }]} />
                <View style={[styles.decoCircle, { backgroundColor: theme.tertiary + '10', bottom: 40, left: -30, width: 100, height: 100 }]} />
            </MotiView>

            <MotiView 
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                style={styles.controls}
            >
                <TouchableOpacity 
                    onPress={resetTimer}
                    style={[styles.controlBtnSecondary, { backgroundColor: theme.surfaceContainerHigh }]}
                >
                    <RotateCcw size={24} color={theme.onSurface} />
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={toggleTimer}
                    style={[styles.playBtn, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
                >
                    {isActive ? <Pause size={32} color="white" fill="white" /> : <Play size={32} color="white" fill="white" style={{ marginLeft: 4 }} />}
                </TouchableOpacity>

                <View style={styles.controlBtnSecondary}>
                    <Zap size={24} color={theme.onSurfaceVariant} opacity={0.3} />
                </View>
            </MotiView>
        </View>

        <View style={styles.footer}>
            <Text style={[styles.quote, { color: theme.onSurfaceVariant }]}>
                "The secret of getting ahead is getting started."
            </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  closeBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerOuter: {
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  timerInner: {
    width: 260,
    height: 260,
    borderRadius: 130,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 10,
  },
  timerText: {
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: -2,
  },
  taskLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  decoCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    zIndex: -1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
    marginTop: 64,
  },
  playBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  controlBtnSecondary: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: 40,
    alignItems: 'center',
  },
  quote: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    opacity: 0.6,
  }
});
