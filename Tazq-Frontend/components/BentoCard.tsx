import React from 'react';
import { StyleSheet, ViewStyle, StyleProp, useWindowDimensions } from 'react-native';
import { MotiView } from 'moti';
import { BlurView } from 'expo-blur';
import { useAppTheme } from '../hooks/useAppTheme';

interface BentoCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  index?: number;
  glass?: boolean;
}

export const BentoCard: React.FC<BentoCardProps> = ({ children, style, index = 0, glass = false }) => {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const { width } = useWindowDimensions();
  const isSmallDevice = width < 380;

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 100, type: 'spring', damping: 20 }}
      style={[
        styles.card,
        {
          backgroundColor: isDark ? '#18181B' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
          shadowColor: '#000',
          shadowOpacity: isDark ? 0.3 : 0.04,
          padding: isSmallDevice ? 16 : 24,
          borderRadius: isSmallDevice ? 28 : 36,
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
    borderWidth: 1.2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 5,
  },
});
