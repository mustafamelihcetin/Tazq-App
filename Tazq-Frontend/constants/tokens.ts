import { Dimensions, Platform, StyleSheet, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Standard design baseline (iPhone X/11 dimensions: 375x812)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

// Tablet/foldable (ör. Pixel Pro Fold) ekranlarda her şeyin devasa şişmesini önlemek
// için ölçek oranını ÜSTTEN sınırla. Telefonlarda oran zaten ≤1.25 → değişmez;
// sadece geniş ekranlarda makul tutar.
const MAX_RATIO = 1.25;
// Dimensions hazır değilse (foldable/çok pencereli açılışta width/height 0/undefined
// olabilir) NaN üretme — 1'e düş (ölçeksiz). NaN bir style değeri render'ı patlatır.
const W_RATIO = SCREEN_WIDTH > 0 ? Math.min(SCREEN_WIDTH / BASE_WIDTH, MAX_RATIO) : 1;
const H_RATIO = SCREEN_HEIGHT > 0 ? Math.min(SCREEN_HEIGHT / BASE_HEIGHT, MAX_RATIO) : 1;

export const scale = (size: number) => W_RATIO * size;
export const verticalScale = (size: number) => H_RATIO * size;
export const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;

// Geniş/foldable/tablet ekranlarda içeriği ortalı bir sütunla sınırlamak için.
// Telefonda ekran zaten < MAX_W → tam genişlik (etkisiz); geniş ekranda ortalanır.
export const MAX_W = 600;
// Floating header/bottom-bar gibi mutlak konumlu öğeleri ortalamak için yan boşluk.
export const sideInset = (screenW: number, base = 16) => Math.max(base, (screenW - MAX_W) / 2);

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

// ── Optik harf aralığı (SF Pro tracking) ──────────────────────────────────
// Apple HIG: büyük başlıklar sıkı (negatif), küçük metin hafif açık (pozitif).
// iOS'ta native his verir; Android'de de okunabilirliği bozmadan tutarlı durur.
export const TRACKING = {
  hero: -0.8,     // ~34pt büyük başlık
  title: -0.4,    // 20–24pt başlık
  subhead: -0.2,  // 17pt
  body: -0.1,     // 14–16pt gövde
  caption: 0.2,   // 11–13pt küçük ipucu / rozet (okunabilirlik için açılır)
} as const;

// ── Yay fiziği (Apple HIG damped spring) ──────────────────────────────────
// Mekanik duration/easing yerine kütle-temelli yay → parmak ucunda "canlı" his.
// Moti/Reanimated ile iki platformda da BİREBİR aynı çalışır.
export const SPRING = { type: 'spring', mass: 1, stiffness: 140, damping: 18 } as const;       // tatlı esneme (kart/giriş)
export const SPRING_SNAPPY = { type: 'spring', mass: 0.7, stiffness: 220, damping: 22 } as const; // hızlı/keskin (buton/sheet)
export const SPRING_SOFT = { type: 'spring', mass: 1.1, stiffness: 90, damping: 18 } as const;    // yumuşak (büyük katman)

// Punto → optik tracking eşlemesi (genel kullanım).
export const trackingFor = (fontSize: number): number =>
  fontSize >= 30 ? TRACKING.hero
  : fontSize >= 20 ? TRACKING.title
  : fontSize >= 16 ? TRACKING.body
  : fontSize <= 12 ? TRACKING.caption
  : TRACKING.subhead;

export const B = {
  thin: Platform.OS === 'android' ? 1 : 1,
  medium: Platform.OS === 'android' ? 1.5 : 1.5,
} as const;

export const getPremiumShadow = (elevation = 5, color = '#000000') => {
  if (Platform.OS === 'android') {
    return {
      elevation: elevation * 1.5,
      shadowColor: color,
    };
  }
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: elevation * 0.8 },
    shadowOpacity: 0.04 + (elevation * 0.005), // softer opacity
    shadowRadius: elevation * 1.5, // wider blur radius
  };
};
