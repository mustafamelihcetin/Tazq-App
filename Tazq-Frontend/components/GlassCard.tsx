import React from 'react';
import { B } from '../constants/tokens';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { useColorScheme } from 'react-native';
import { Colors } from '../constants/Colors';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

export const GlassCard = ({ children, style }: GlassCardProps) => {
  const scheme = useColorScheme();
  const theme = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <View style={[
      styles.card,
      {
        backgroundColor: scheme === 'dark' ? '#17171C' : theme.surfaceContainerLow,
        borderColor: scheme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)',
      },
      style,
    ]}>
      <View style={styles.inner}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: B.thin,
    overflow: 'hidden',
    ...(Platform.OS === 'android' ? { elevation: 2 } : {}),
  },
  inner: {
    padding: 16,
  },
});
