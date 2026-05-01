import React from 'react';
import { StyleSheet, ViewStyle, useColorScheme, Platform } from 'react-native';
import { MotiView } from 'moti';
import { BlurView } from 'expo-blur';
import { Colors } from '../constants/Colors';

import { useAppTheme } from '../hooks/useAppTheme';

interface BentoCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  index?: number;
  glass?: boolean;
}

export const BentoCard: React.FC<BentoCardProps> = ({ children, style, index = 0, glass = false }) => {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 100, type: 'spring', damping: 20 }}
      style={[
        styles.card,
        {
          backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          shadowColor: '#000',
          shadowOpacity: isDark ? 0.4 : 0.04,
        },
        style,
      ]}
    >
      {glass && (
        <BlurView 
            intensity={isDark ? 20 : 40} 
            tint={isDark ? 'dark' : 'light'} 
            style={StyleSheet.absoluteFill} 
        />
      )}
      {children}
    </MotiView>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 36,
    padding: 24,
    borderWidth: 1.2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 5,
  },
});
