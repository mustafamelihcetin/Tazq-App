import { Platform } from 'react-native';

/**
 * Sağlık verisinin geldiği yerin ADI — platforma göre (bkz. shared/services/sleepHealth.ts:
 * iOS → HealthKit, Android → Health Connect). Android'de "Apple Sağlık" yazıyordu
 * (cihazda görüldü); ad artık tek yerden gelir.
 */
const APPLE = { tr: 'Apple Sağlık', en: 'Apple Health' } as const;

export const healthSourceName = (lang: 'tr' | 'en'): string =>
  Platform.OS === 'android' ? 'Health Connect' : APPLE[lang];
