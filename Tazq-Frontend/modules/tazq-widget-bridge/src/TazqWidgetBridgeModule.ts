import { NativeModule, requireOptionalNativeModule } from 'expo';
import type { TazqWidgetBridgeEvents } from './TazqWidgetBridge.types';

declare class TazqWidgetBridgeModule extends NativeModule<TazqWidgetBridgeEvents> {
  updateSharedData(json: string): Promise<void>;
}

/**
 * `requireOptionalNativeModule` KASITLI — `requireNativeModule` eksik modülde
 * fırlatır ve Metro bunu DEV'de try/catch'i atlayıp kırmızı ekrana basar (eski
 * dev client'ta, native kod henüz derlenmemişken). Bu, çağıranın modülü
 * `null` kontrolüyle güvenle es geçebilmesini sağlıyor — sessizce, gürültüsüz.
 */
export default requireOptionalNativeModule<TazqWidgetBridgeModule>('TazqWidgetBridge');
