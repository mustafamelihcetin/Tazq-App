import React from 'react';
import { View, StyleSheet, Platform, ViewProps, useColorScheme } from 'react-native';
import { MotiView } from 'moti';
import { BlurView } from 'expo-blur';
import { Colors } from '../constants/Colors';

interface BentoCardProps extends ViewProps {
  children: React.ReactNode;
  index?: number;
  glass?: boolean;
}

export function BentoCard({ children, index = 0, glass, style, ...props }: BentoCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const content = (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ delay: index * 100, type: 'spring', damping: 15 }}
      style={[
        styles.card,
        { 
          backgroundColor: glass ? 'transparent' : theme.surfaceContainerLow,
          borderColor: theme.outlineVariant + '20' 
        },
        style
      ]}
      {...props}
    >
      {glass && Platform.OS === 'ios' ? (
        <BlurView intensity={30} tint={colorScheme} style={StyleSheet.absoluteFill}>
          <View style={styles.contentPadding}>{children}</View>
        </BlurView>
      ) : (
        <View style={styles.contentPadding}>{children}</View>
      )}
    </MotiView>
  );

  return content;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 32,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#2d2f31',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  contentPadding: {
    padding: 24,
    flex: 1,
    backgroundColor: 'transparent',
  }
});
