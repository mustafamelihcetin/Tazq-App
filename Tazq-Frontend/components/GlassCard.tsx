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
        backgroundColor: scheme === 'dark' ? '#17171C' : theme.surfaceContainerLow,
        borderWidth: 1,
        borderColor: scheme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)',
      },
      style
    ]}>
      <View className="p-4">
        {children}
      </View>
    </View>
  );
};
