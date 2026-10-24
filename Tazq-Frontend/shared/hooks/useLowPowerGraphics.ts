import { Platform } from 'react-native';
import * as Device from 'expo-device';

/*
  ── DÜŞÜK GÜÇLÜ GRAFİK — sürekli çizilen efektleri sadeleştirme kararı ───────────
  Cihazda ölçüldü (Huawei Y6 2019: PowerVR GPU, yalnız 32-bit, 2 GB): Skia her karede
  SurfaceTexture.updateTexImage çağırıyor, sürücü reddediyor → saniyede ~25 istisna.
  Skia kendi kodunda "can safely be ignored" diyor; görüntü bozulmuyor ama her kare bir
  istisna nesnesi zayıf işlemciyi ve pili yoruyor. Kütüphaneye dokunmak yerine bu tür
  cihazda sürekli animasyonlu efekt DURAKLATILIR (tek kare çizilir).

  Sınıflama endüstri standardından: Facebook device-year-class (expo-device
  `deviceYearClass`) — cihazı RAM/çekirdek/saat hızına göre "hangi yılın amiral
  gemisi" diye yıllara eşler. Bilinmiyorsa RAM'e düşülür.

  iOS'ta HER ZAMAN false: iOS davranışı bu kararla değişmez.
*/

/** Bu yıl sınıfı ve öncesi zayıf sayılır (2 GB RAM'li giriş seviyesi cihazlar). */
const LOW_YEAR_CLASS = 2015;
/** Yıl sınıfı yoksa: 3 GB altı RAM. */
const LOW_MEMORY_BYTES = 3 * 1024 ** 3;

export function isLowPowerGraphics(d: { os: string; yearClass: number | null; totalMemory: number | null }): boolean {
  if (d.os !== 'android') return false;
  if (d.yearClass != null) return d.yearClass <= LOW_YEAR_CLASS;
  return d.totalMemory != null && d.totalMemory < LOW_MEMORY_BYTES;
}

// Cihaz özellikleri oturum boyunca değişmez — bir kez hesaplanır.
const LOW_POWER = isLowPowerGraphics({
  os: Platform.OS,
  yearClass: Device.deviceYearClass ?? null,
  totalMemory: Device.totalMemory ?? null,
});

export function useLowPowerGraphics(): boolean {
  return LOW_POWER;
}
