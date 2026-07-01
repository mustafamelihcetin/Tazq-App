import React from 'react';
import { StyleSheet, ViewStyle, StyleProp, TouchableOpacity, Platform } from 'react-native';
import { MotiView } from 'moti';
import { BlurView } from 'expo-blur';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { S, R, B } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';

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
          borderColor: isDark ? theme.outline : 'transparent',
          borderWidth: isDark ? B.thin : 0,
          ...(Platform.OS === 'ios' ? {
            shadowColor: isDark ? '#000' : '#000',
            shadowOpacity: isDark ? 0.2 : 0.04,
            shadowOffset: { width: 0, height: 6 },
            shadowRadius: 16,
          } : {
            elevation: isDark ? 2 : 1,
          }),
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
    return <Touchable onPress={onPress} activeOpacity={0.85}>{card}</Touchable>;
  }
  return card;
};

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
});
