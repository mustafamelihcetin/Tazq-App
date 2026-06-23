import React from 'react';
import { B } from '../constants/tokens';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MotiView } from 'moti';
import { useFocusStore } from '../store/useFocusStore';
import { useAppTheme } from '../hooks/useAppTheme';
import { useLanguageStore } from '../store/useLanguageStore';
import { Zap, Activity } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { Touchable } from '@/components/Touchable';

export const StatusHub = ({ onPress }: { onPress: () => void }) => {
  const { theme, colorScheme } = useAppTheme();
  const { language } = useLanguageStore();
  const isDark = colorScheme === 'dark';
  const { isActive } = useFocusStore();
  const tr = language === 'tr';

  return (
    <Touchable
      activeOpacity={0.7}
      onPress={onPress}
      style={styles.wrapper}
    >
      <View style={{ alignItems: 'center', gap: 3 }}>
        <MotiView
          from={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={[styles.container, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
        >
          <BlurView intensity={isDark ? 25 : 15} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />

          <MotiView
            animate={{
              scale: isActive ? [1, 1.15, 1] : 1,
              opacity: isActive ? [0.7, 1, 0.7] : 1,
            }}
            transition={{ loop: true, duration: 2000, type: 'timing' }}
            style={styles.iconContainer}
          >
            {isActive ? (
              <Activity size={18} color={theme.primary} strokeWidth={2.5} />
            ) : (
              <Zap size={18} color={theme.onSurface} strokeWidth={2} />
            )}
          </MotiView>

          {/* Action Dot */}
          <View style={[styles.dot, { backgroundColor: theme.primary }]} />
        </MotiView>
        <Text style={{ fontSize: 8, fontWeight: '800', color: theme.onSurfaceVariant, opacity: 0.55, letterSpacing: 0.3 }}>
          INSIGHT
        </Text>
      </View>
    </Touchable>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    padding: 4,
  },
  container: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: B.thin,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.8,
  }
});
