import React from 'react';
import { View, StyleSheet, Platform, ViewProps, useColorScheme } from 'react-native';
import { MotiView } from 'moti';
import { BlurView } from 'expo-blur';
import { Colors } from '../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';

interface BentoCardProps extends ViewProps {
  children: React.ReactNode;
  index?: number;
  glass?: boolean;
}

export function BentoCard({ children, index = 0, glass, style, ...props }: BentoCardProps) {
  const colorScheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  const content = (
    <MotiView
      from={{ opacity: 0, scale: 0.95, translateY: 20 }}
      animate={{ opacity: 1, scale: 1, translateY: 0 }}
      transition={{ delay: index * 80, type: 'spring', damping: 18, stiffness: 100 }}
      style={[
        styles.card,
        { 
          backgroundColor: glass ? 'transparent' : theme.surfaceContainerLow,
          borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
        },
        style
      ]}
      {...props}
    >
      {glass && Platform.OS === 'ios' && (
        <BlurView intensity={25} tint={colorScheme} style={StyleSheet.absoluteFill} />
      )}
      
      <LinearGradient
        colors={colorScheme === 'dark' ? 
            ['rgba(255,255,255,0.02)', 'transparent'] : 
            ['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.05)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={styles.contentPadding}>{children}</View>
    </MotiView>
  );

  return content;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 32,
    borderWidth: 1.2,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  contentPadding: {
    padding: 24,
    flex: 1,
    backgroundColor: 'transparent',
  }
});
