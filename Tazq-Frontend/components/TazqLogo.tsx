import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

const LOGO_WHITE = require('../assets/images/tazq_text_white.png');
const LOGO_DARK = require('../assets/images/tazq_text_dark.png');

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
}) => {
  const { colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';

  const effectiveHeight = size || height;
  const effectiveWidth = width || effectiveHeight * 3.2;

  return (
    <View style={[styles.container, style]}>
      <Image
        source={isDark ? LOGO_WHITE : LOGO_DARK}
        style={{ width: effectiveWidth, height: effectiveHeight }}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
