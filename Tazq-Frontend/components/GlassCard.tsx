import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useColorScheme } from 'react-native';
import { Colors } from '../constants/Colors';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const GlassCard = ({ children, style }: GlassCardProps) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <View className="overflow-hidden rounded-3xl" style={[
      {
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
      },
      style
    ]}>
      <View className="p-4">
        {children}
      </View>
    </View>
  );
};
