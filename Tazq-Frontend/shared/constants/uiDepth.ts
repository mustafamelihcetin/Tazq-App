import { Animated } from 'react-native';

/**
 * UI derinlik (iOS PageSheet): bir alt-sheet açıldığında arka ekranın hafifçe
 * küçülüp (scale), köşelerinin yuvarlanıp (radius) ve kararması (dim) için
 * uygulama-genel bir Animated değer. Ref sayımlı → iç içe sheet'lerde tutarlı.
 *
 * NOT: borderRadius animasyonu native driver desteklemediğinden JS-driven (false).
 * Tek seferlik geçiş olduğundan performans etkisi ihmal edilebilir.
 */
export const uiDepth = new Animated.Value(0);

let depthCount = 0;

const SPRING = { useNativeDriver: false, mass: 0.9, stiffness: 150, damping: 20 } as const;

export function pushDepth() {
  depthCount += 1;
  if (depthCount === 1) Animated.spring(uiDepth, { toValue: 1, ...SPRING }).start();
}

export function popDepth() {
  depthCount = Math.max(0, depthCount - 1);
  if (depthCount === 0) Animated.spring(uiDepth, { toValue: 0, ...SPRING }).start();
}
