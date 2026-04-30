import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useColorScheme } from 'react-native';
import { Colors } from '../constants/Colors';
import { MotiView } from 'moti';

interface BentoCardProps {
  children: React.ReactNode;
  className?: string;
  index?: number;
  glass?: boolean;
}

export const BentoCard = ({ children, className = '', index = 0, glass = false }: BentoCardProps) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const content = (
    <View 
      className={`p-6 rounded-xl overflow-hidden ${className}`}
      style={[
        styles.cardBase,
        !glass && { backgroundColor: theme.surfaceContainerLowest },
        !glass && styles.clayShadow
      ]}
    >
      {children}
    </View>
  );

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.9, translateY: 20 }}
      animate={{ opacity: 1, scale: 1, translateY: 0 }}
      transition={{ 
        type: 'spring',
        delay: index * 100,
        damping: 15,
        stiffness: 100
      }}
      className="flex-1"
    >
      {glass ? (
        <BlurView 
          intensity={colorScheme === 'dark' ? 30 : 50} 
          tint={colorScheme}
          className="rounded-xl overflow-hidden border border-white/10"
          style={styles.glassContainer}
        >
          {content}
        </BlurView>
      ) : (
        content
      )}
    </MotiView>
  );
};

const styles = StyleSheet.create({
  cardBase: {
    minHeight: 180,
  },
  clayShadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.03, // Extra soft
        shadowRadius: 24,
      },
      android: {
        elevation: 2,
      },
    }),
    // Inner Glow (Hint for claymorphism)
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)', // Slightly more visible for the toy feel
  },
  glassContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 40,
    overflow: 'hidden',
  },
});
