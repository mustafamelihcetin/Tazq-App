import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

interface TazqLogoProps {
  size?: number;
  height?: number;
  width?: number;
  style?: any;
  color?: string;
  showIcon?: boolean;
}

export const TazqLogo: React.FC<TazqLogoProps> = ({ 
  size,
  height = 24,
  width,
  style,
  color,
  showIcon = false
}) => {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const brandColor = color || theme.onSurface;
  
  // Use size if provided, otherwise fallback to height
  const effectiveSize = size || height;
  
  return (
    <View style={[styles.container, style]}>
      {showIcon && (
        <Image 
          source={require('../assets/images/tazq_icon.png')} 
          style={{ 
            width: effectiveSize * 1.6, 
            height: effectiveSize * 1.6, 
            marginBottom: 6,
            borderRadius: effectiveSize * 0.4
          }} 
          resizeMode="contain"
        />
      )}
      <Text 
        style={[
            styles.logoText, 
            { color: brandColor, fontSize: effectiveSize },
            isDark && { textShadowColor: theme.primary + '60', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 }
        ]}
      >
        TAZQ
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 24,
    fontFamily: 'Jakarta-ExtraBold',
    letterSpacing: -1.5,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 4,
  },
});
