import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useColorScheme } from 'react-native';
import { Colors } from '../constants/Colors';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const GlassCard = ({ children, style }: GlassCardProps) => {
  const scheme = useColorScheme();
  const theme = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <View className="overflow-hidden rounded-3xl" style={[
      {
        backgroundColor: theme.surfaceContainerLow,
        borderWidth: 1,
        borderColor: theme.outline,
      },
      style
    ]}>
      <View className="p-4">
        {children}
      </View>
    </View>
  );
};
