import { Dimensions, Platform, StyleSheet, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Standard design baseline (iPhone X/11 dimensions: 375x812)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

export const scale = (size: number) => (SCREEN_WIDTH / BASE_WIDTH) * size;
export const verticalScale = (size: number) => (SCREEN_HEIGHT / BASE_HEIGHT) * size;
export const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;

export const S = {
  xs: moderateScale(4),
  sm: moderateScale(8),
  md: moderateScale(16),
  lg: moderateScale(24),
  xl: moderateScale(40),
  xxl: moderateScale(64),
} as const;

export const R = {
  sm: moderateScale(8),
  md: moderateScale(16),
  lg: moderateScale(24),
  full: 999, // full border radius should not be scaled
} as const;

export const F = {
  caption: moderateScale(11),
  body: moderateScale(14),
  subhead: moderateScale(17),
  title: moderateScale(22),
  hero: moderateScale(34),
} as const;

export const LH = {
  tight: 1.2,
  normal: 1.45,
  relaxed: 1.65,
} as const;

export const B = {
  thin: Platform.OS === 'android' ? 1 : 1,
  medium: Platform.OS === 'android' ? 1.5 : 1.5,
} as const;

export const getPremiumShadow = (elevation = 5, color = '#000000') => {
  if (Platform.OS === 'android') {
    return {
      elevation,
      shadowColor: color,
    };
  }
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: elevation / 2 },
    shadowOpacity: 0.1 + (elevation * 0.01),
    shadowRadius: elevation,
  };
};
