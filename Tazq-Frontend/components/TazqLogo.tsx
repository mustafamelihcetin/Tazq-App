import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

interface TazqLogoProps {
  width?: number;
  height?: number;
  style?: any;
  color?: string;
  showIcon?: boolean;
}

export const TazqLogo: React.FC<TazqLogoProps> = ({ 
  height = 40,
  style,
  color,
  showIcon = false
}) => {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const brandColor = color || theme.onSurface;
  
  return (
    <View style={[styles.container, style]}>
      {showIcon && (
        <Image 
          source={require('../assets/images/tazq_icon.png')} 
          style={{ 
            width: height * 1.6, 
            height: height * 1.6, 
            marginBottom: 6,
            borderRadius: 14
          }} 
          resizeMode="contain"
        />
      )}
      <Text 
        style={[
            styles.logoText, 
            { color: brandColor },
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
