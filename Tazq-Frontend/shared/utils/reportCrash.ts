import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { captureError } from '@/shared/utils/sentry';
import { SupportService } from '@/shared/services/api';

/**
 * Render çökmesini Sentry'ye ve yönetim paneline raporlar.
 *
 * Kök sınırın `componentDidCatch`'inde yaşıyordu; rota sınırları (expo-router
 * `ErrorBoundary` dışa aktarımı) componentDidCatch'ten geçmediği için ortak yola alındı —
 * yoksa ekran düzeyindeki çökmeler sessizce kaybolurdu.
 */
export function reportRenderCrash(error: Error, componentStack = ''): void {
  captureError(error, { componentStack });
  try {
    const deviceName = Device.modelName || Device.designName || 'Unknown Device';
    SupportService.reportCrash({
      errorMessage: error?.message || 'Unknown React Crash',
      stackTrace: `${error?.stack ?? ''}\n\nComponent Stack:\n${componentStack}`,
      deviceName,
      platform: `${Platform.OS} ${Platform.Version}`,
      appVersion: Constants.expoConfig?.version || '1.0.0',
    /*
      BURADA BİLEREK `swallow()` YOK.
      `swallow` hatayı Sentry'ye yazıyor; burası ise çökme raporlayıcısının KENDİ
      hatası. Sentry'nin kendisi bozuksa aynı yola tekrar girmek özyineleme üretir
      ve gerçek çökme kaydını da kaybettirebilir. Son çare olarak konsol kalıyor.
    */
    }).catch((e) => console.warn('[reportRenderCrash failed]', e));
  } catch (e) {
    console.warn('[reportRenderCrash failed to gather crash metadata]', e);
  }
}
