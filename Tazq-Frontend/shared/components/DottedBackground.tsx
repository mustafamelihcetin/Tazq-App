import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface AmbientBackgroundProps {
  color: string;
  opacity?: number;
  size?: number; // kept for compatibility but unused
  dotSize?: number; // kept for compatibility but unused
}

export function DottedBackground({
  color,
  opacity = 0.03, // extremely subtle
}: AmbientBackgroundProps) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[color, 'transparent']}
        start={{ x: 0.1, y: -0.2 }}
        end={{ x: 0.5, y: 0.5 }}
        style={[StyleSheet.absoluteFill, { opacity: opacity * 1.5 }]}
      />
      <LinearGradient
        colors={['transparent', color]}
        start={{ x: 0.3, y: 0.3 }}
        end={{ x: 1, y: 1.2 }}
        style={[StyleSheet.absoluteFill, { opacity: opacity }]}
      />
    </View>
  );
}
