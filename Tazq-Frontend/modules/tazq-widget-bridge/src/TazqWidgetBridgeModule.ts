import { NativeModule, requireOptionalNativeModule } from 'expo';
import type { TazqWidgetBridgeEvents } from './TazqWidgetBridge.types';

declare class TazqWidgetBridgeModule extends NativeModule<TazqWidgetBridgeEvents> {
  updateSharedData(json: string): Promise<void>;
}

let cached: TazqWidgetBridgeModule | null | undefined;

/**
 * TEMBEL (lazy) — BİLEREK modül tepe seviyesinde ÇAĞRILMIYOR.
 *
 * Eskiden `export default requireOptionalNativeModule(...)` tepe seviyesindeydi.
 * `widgetBridge.ts`, `app/_layout.tsx`'in en üstünde import edilince bu çağrı
 * UYGULAMA AÇILIRKEN, React hiç başlamadan, Sentry devreye girmeden tetikleniyordu
 * — native modülün kendi `OnCreate` bloğu (WCSession aktivasyonu) o an çalışıyor
 * ve splash ekranında sessiz bir çökmeye yol açıyordu (Sentry'ye bile düşmüyordu,
 * çünkü çökme Sentry.init()'ten ÖNCEYDİ). `requireOptionalNativeModule` firlatmaz
 * diye güvenli sayılmıştı ama asıl sorun ÇAĞRILDIĞI AN'dı, hata tipi değil.
 *
 * Şimdi yalnız GERÇEKTEN bir widget/watch işlemi yapılacağı an (`pushWidgetSummary`,
 * `initWatchBridge` — ikisi de kullanıcı giriş yaptıktan, uygulama ayaktayken
 * çalışır) çağrılıyor; try/catch ekstra bir güvenlik ağı.
 */
export function getTazqWidgetBridge(): TazqWidgetBridgeModule | null {
  if (cached !== undefined) return cached;
  try {
    cached = requireOptionalNativeModule<TazqWidgetBridgeModule>('TazqWidgetBridge');
  } catch {
    cached = null;
  }
  return cached;
}
