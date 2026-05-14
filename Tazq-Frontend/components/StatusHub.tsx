import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { MotiView } from 'moti';
import { useFocusStore } from '../store/useFocusStore';
import { useAppTheme } from '../hooks/useAppTheme';
import { Zap, BrainCircuit, Activity } from 'lucide-react-native';
import { BlurView } from 'expo-blur';

export const StatusHub = ({ onPress }: { onPress: () => void }) => {
  const { theme, isDark } = useAppTheme();
  const { isActive } = useFocusStore();

  return (
    <TouchableOpacity 
        activeOpacity={0.7} 
        onPress={onPress}
        style={styles.wrapper}
    >
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
          transition={{
            loop: true,
            duration: 2000,
            type: 'timing',
          }}
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
    </TouchableOpacity>
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
    borderWidth: 1,
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
