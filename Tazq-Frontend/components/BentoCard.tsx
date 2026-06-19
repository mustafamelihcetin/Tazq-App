import React from 'react';
import { StyleSheet, ViewStyle, StyleProp, TouchableOpacity } from 'react-native';
import { MotiView } from 'moti';
import { BlurView } from 'expo-blur';
import { useAppTheme } from '../hooks/useAppTheme';
import { S, R } from '../constants/tokens';

interface BentoCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  index?: number;
  glass?: boolean;
  onPress?: () => void;
}

export const BentoCard: React.FC<BentoCardProps> = ({ children, style, index = 0, glass = false, onPress }) => {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';

  const card = (
    <MotiView
      from={{ opacity: 0, translateY: 6 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ delay: index * 80, type: 'spring', damping: 22, stiffness: 200 }}
      style={[
        styles.card,
        {
          backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLowest,
          borderColor: isDark ? theme.outline : 'rgba(0,0,0,0.05)',
          shadowColor: isDark ? theme.primary : '#000',
          shadowOpacity: isDark ? 0.12 : 0.05,
          padding: S.lg,
          borderRadius: R.lg,
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

  if (onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.85}>{card}</TouchableOpacity>;
  }
  return card;
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 4,
  },
});
